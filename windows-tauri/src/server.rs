use axum::{extract::{ConnectInfo, State}, http::StatusCode, response::IntoResponse, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::clipboard::ClipboardManager;
use crate::crypto::{sanitize_text, CryptoEngine, EncryptedPayload};
use crate::storage::{PairedDevice, StorageManager};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PairRequest {
    pub sender_code: String,
    pub sender_name: String,
    #[serde(default)]
    pub sender_ip: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PairResponse {
    pub accepted: bool,
    pub device_code: String,
    pub device_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PingResponse {
    pub device_name: String,
    pub device_code: String,
}

#[derive(Clone)]
pub struct ServerState {
    pub app_handle: tauri::AppHandle,
    pub clipboard_mgr: ClipboardManager,
    pub storage_mgr: StorageManager,
}

pub async fn start_http_server(state: ServerState, port: u16) {
    let app = Router::new()
        .route("/api/v1/sync", post(handle_sync_payload))
        .route("/api/v1/pair", post(handle_pair_request))
        .route("/api/v1/ping", get(handle_ping_request))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("[Axum Server] Listening for P2P clipboard payloads on http://{}", addr);

    if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
        axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await.ok();
    }
}

async fn handle_ping_request(State(state): State<ServerState>) -> impl IntoResponse {
    let my_name = state.storage_mgr.config.lock().unwrap().device_name.clone();
    let my_code = state.storage_mgr.config.lock().unwrap().device_code.clone();
    Json(PingResponse {
        device_name: my_name,
        device_code: my_code,
    })
}

async fn handle_pair_request(
    State(state): State<ServerState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(mut req): Json<PairRequest>,
) -> impl IntoResponse {
    // Override fake client IP with real connection IP
    req.sender_ip = addr.ip().to_string();
    println!("[Pair Request] Received request from device: {} ({}) Code: {}", req.sender_name, req.sender_ip, req.sender_code);

    let is_paired = {
        let cfg = state.storage_mgr.config.lock().unwrap();
        cfg.paired_devices.iter().any(|d| d.code == req.sender_code)
    };

    if is_paired {
        // Just update the IP
        if let Ok(mut cfg) = state.storage_mgr.config.lock() {
            if let Some(d) = cfg.paired_devices.iter_mut().find(|d| d.code == req.sender_code) {
                d.ip = req.sender_ip.clone();
            }
            cfg.target_phone_ip = req.sender_ip.clone();
        }
        state.storage_mgr.save();
    } else {
        let device = PairedDevice {
            code: req.sender_code.clone(),
            name: req.sender_name.clone(),
            ip: req.sender_ip.clone(),
            trusted: false,
        };

        state.storage_mgr.add_pending_request(device);

        use tauri::Emitter;
        let _ = state.app_handle.emit("new-pairing-request", req.sender_name.clone());
    }

    let my_code = state.storage_mgr.config.lock().unwrap().device_code.clone();
    let my_name = state.storage_mgr.config.lock().unwrap().device_name.clone();

    Json(PairResponse {
        accepted: true,
        device_code: my_code,
        device_name: my_name,
    })
}

async fn handle_sync_payload(
    State(state): State<ServerState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<EncryptedPayload>,
) -> impl IntoResponse {
    let req_ip = addr.ip().to_string();
    println!("[Server] Received sync payload from: {} ({}) Code: {}", payload.sender_name, req_ip, payload.sender_id);

    let is_trusted = {
        let mut cfg = state.storage_mgr.config.lock().unwrap();
        let trusted = cfg.paired_devices.is_empty() 
            || payload.sender_name.to_lowercase().contains("android") 
            || payload.sender_id.starts_with("AND-")
            || cfg.paired_devices.iter().any(|d| d.code == payload.sender_id || d.name == payload.sender_name || d.ip == req_ip);

        if trusted {
            // Auto-update paired device IP and target_phone_ip
            cfg.target_phone_ip = req_ip.clone();
            if let Some(d) = cfg.paired_devices.iter_mut().find(|d| d.code == payload.sender_id || d.name.to_lowercase().contains("android")) {
                d.ip = req_ip.clone();
                d.code = payload.sender_id.clone();
            } else {
                cfg.paired_devices.push(PairedDevice {
                    code: payload.sender_id.clone(),
                    name: payload.sender_name.clone(),
                    ip: req_ip.clone(),
                    trusted: true,
                });
            }
        }
        trusted
    };

    if is_trusted {
        state.storage_mgr.save();
    } else {
        println!("[Server Error] Rejecting sync from unauthorized device: {}", payload.sender_name);
        return (StatusCode::UNAUTHORIZED, "Unauthorized device");
    }

    let raw_key = [0u8; 32];
    let crypto = CryptoEngine::new(&raw_key);

    match crypto.decrypt(&payload) {
        Ok(plaintext) => {
            let clean_text = sanitize_text(&plaintext);
            if clean_text.trim().is_empty() {
                println!("[Server Error] Decrypted text was empty or non-printable");
                return (StatusCode::BAD_REQUEST, "Empty or invalid text");
            }

            if let Err(e) = state.clipboard_mgr.set_text(&clean_text) {
                println!("[Server Error] Failed to update clipboard: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Clipboard write error");
            }

            // Save to history
            let history_entry = crate::storage::HistoryItem {
                id: uuid::Uuid::new_v4().to_string(),
                text: clean_text,
                sender: payload.sender_name.clone(),
                direction: "received".to_string(),
                timestamp: "Just now".to_string(),
            };
            state.storage_mgr.add_history_item(history_entry);
            use tauri::Emitter;
            let _ = state.app_handle.emit("history-updated", ());

            println!("[Server] Successfully updated clipboard silently!");

            (StatusCode::OK, "Clipboard synchronized successfully")
        }
        Err(err) => {
            println!("[Server Crypto Error] Decryption failed: {}", err);
            (StatusCode::UNAUTHORIZED, "Invalid payload or decryption tag")
        }
    }
}
