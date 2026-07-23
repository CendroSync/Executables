#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod crypto;
mod server;
mod storage;
mod window_manager;

use clipboard::ClipboardManager;
use crypto::CryptoEngine;
use server::{start_http_server, ServerState};
use storage::StorageManager;
use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State,
};

#[derive(Clone)]
struct AppState {
    clipboard_mgr: ClipboardManager,
    storage_mgr: StorageManager,
}

async fn discover_android_ip(local_ip: &str) -> Option<String> {
    let parts: Vec<&str> = local_ip.split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    let subnet = format!("{}.{}.{}", parts[0], parts[1], parts[2]);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1200))
        .build()
        .ok()?;

    let mut tasks = Vec::new();
    for i in 1..=254 {
        let test_ip = format!("{}.{}", subnet, i);
        let client_clone = client.clone();
        tasks.push(tokio::spawn(async move {
            let url = format!("http://{}:52431/api/v1/ping", test_ip);
            if let Ok(res) = client_clone.get(&url).send().await {
                if res.status().is_success() {
                    return Some(test_ip);
                }
            }
            None
        }));
    }

    for task in tasks {
        if let Ok(Some(found_ip)) = task.await {
            println!("[AutoDiscover] Discovered Android device at IP {}", found_ip);
            return Some(found_ip);
        }
    }
    None
}

#[tauri::command]
async fn send_clipboard_payload(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let text = state.clipboard_mgr.get_text()?;
    let (target_ip, my_code) = {
        let cfg = state.storage_mgr.config.lock().unwrap();
        (cfg.target_phone_ip.clone(), cfg.device_code.clone())
    };

    let raw_key = [0u8; 32];
    let crypto = CryptoEngine::new(&raw_key);
    let payload = crypto.encrypt(&text, &my_code, "Windows PC")?;

    let storage = state.storage_mgr.clone();
    let text_clone = text.clone();
    let app_handle = app.clone();

    tokio::spawn(async move {
        let client_fast = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(1800))
            .build()
            .unwrap_or_default();

        let mut sent = false;
        let mut final_ip = target_ip.clone();

        if !final_ip.is_empty() {
            let url = format!("http://{}:52431/api/v1/sync", final_ip);
            if let Ok(res) = client_fast.post(&url).json(&payload).send().await {
                if res.status().is_success() {
                    sent = true;
                }
            }
        }

        if !sent {
            println!("[Client] Stored Android IP ({}) unreachable after reboot. Auto-discovering local subnet...", final_ip);
            let local_ip = get_local_ip();
            if let Some(new_ip) = discover_android_ip(&local_ip).await {
                println!("[Client] Updating target IP to {}", new_ip);
                final_ip = new_ip.clone();
                if let Ok(mut cfg) = storage.config.lock() {
                    cfg.target_phone_ip = new_ip.clone();
                    for d in &mut cfg.paired_devices {
                        d.ip = new_ip.clone();
                    }
                }
                storage.save();

                let new_url = format!("http://{}:52431/api/v1/sync", final_ip);
                let client_retry = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_millis(3500))
                    .build()
                    .unwrap_or_default();

                if let Ok(res) = client_retry.post(&new_url).json(&payload).send().await {
                    if res.status().is_success() {
                        sent = true;
                        println!("[Client] Successfully beamed payload to auto-discovered IP {}", final_ip);
                    }
                }
            }
        }

        if sent {
            storage.add_history_item(storage::HistoryItem {
                id: uuid::Uuid::new_v4().to_string(),
                text: text_clone,
                sender: "Windows PC".to_string(),
                direction: "sent".to_string(),
                timestamp: "Just now".to_string(),
            });
            use tauri::Emitter;
            let _ = app_handle.emit("history-updated", ());
        } else {
            eprintln!("[Client Error] Failed to reach Android device on local network.");
        }
    });

    window_manager::hide_micro_window(&app);
    Ok(())
}

#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Vec<storage::HistoryItem> {
    state.storage_mgr.get_history()
}

#[tauri::command]
fn delete_history_item(state: State<'_, AppState>, id: String) {
    state.storage_mgr.delete_history_item(&id);
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) {
    state.storage_mgr.clear_history();
}

#[tauri::command]
fn dismiss_popup(app: AppHandle) {
    window_manager::hide_micro_window(&app);
}

#[tauri::command]
fn get_local_ip() -> String {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok();
    if let Some(s) = socket {
        if s.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = s.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

#[tauri::command]
fn get_device_code(state: State<'_, AppState>) -> String {
    state.storage_mgr.config.lock().unwrap().device_code.clone()
}

#[tauri::command]
async fn request_device_pair(state: State<'_, AppState>, code: String) -> Result<String, String> {
    let target_ip = state.storage_mgr.config.lock().unwrap().target_phone_ip.clone();
    let my_code = state.storage_mgr.config.lock().unwrap().device_code.clone();

    let client = reqwest::Client::new();
    let url = format!("http://{}:52431/api/v1/pair", target_ip);

    let req = server::PairRequest {
        sender_code: my_code,
        sender_name: "Windows PC".to_string(),
        sender_ip: get_local_ip(),
    };

    let res = client.post(&url).json(&req).send().await.map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok(format!("Pair request sent to code {}", code))
    } else {
        Err(format!("Device pairing failed: status {}", res.status()))
    }
}

#[tauri::command]
fn save_target_ip(state: State<'_, AppState>, ip: String) {
    if let Ok(mut cfg) = state.storage_mgr.config.lock() {
        cfg.target_phone_ip = ip;
    }
    state.storage_mgr.save();
}

#[tauri::command]
fn show_popup_demo(app: AppHandle) {
    if let Ok(text) = app.state::<AppState>().clipboard_mgr.get_text() {
        window_manager::show_micro_window(&app, &text).ok();
    } else {
        window_manager::show_micro_window(&app, "Sample text for notification test").ok();
    }
}

#[tauri::command]
fn get_pending_requests(state: State<'_, AppState>) -> Vec<storage::PairedDevice> {
    state.storage_mgr.config.lock().unwrap().pending_requests.clone()
}

#[tauri::command]
fn get_paired_devices(state: State<'_, AppState>) -> Vec<storage::PairedDevice> {
    state.storage_mgr.config.lock().unwrap().paired_devices.clone()
}

#[tauri::command]
fn accept_request(state: State<'_, AppState>, code: String) -> Result<(), String> {
    if let Some(dev) = state.storage_mgr.accept_pending_request(&code) {
        if let Ok(mut cfg) = state.storage_mgr.config.lock() {
            cfg.target_phone_ip = dev.ip.clone();
        }
        state.storage_mgr.save();
        Ok(())
    } else {
        Err("Request not found".to_string())
    }
}

#[tauri::command]
fn reject_request(state: State<'_, AppState>, code: String) {
    state.storage_mgr.reject_pending_request(&code);
}

#[tauri::command]
fn unpair_device(state: State<'_, AppState>, code: String) {
    state.storage_mgr.remove_paired_device(&code);
}

#[tokio::main]
async fn main() {
    let clipboard_mgr = ClipboardManager::new();
    let storage_mgr = StorageManager::new();

    let app_state = AppState {
        clipboard_mgr: clipboard_mgr.clone(),
        storage_mgr: storage_mgr.clone(),
    };

    tauri::Builder::default()
        .manage(app_state.clone())
        .setup(move |app| {
            // Initialize System Tray Menu
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("CendrosyncP2P")
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        println!("[Tray] System tray icon clicked -> Showing Control Center");
                        let handle = tray.app_handle();
                        if let Some(main_win) = handle.get_webview_window("main") {
                            let _ = main_win.show();
                            let _ = main_win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Start Axum HTTP listener background server
            let server_state = ServerState {
                app_handle: app.handle().clone(),
                clipboard_mgr: clipboard_mgr.clone(),
                storage_mgr: storage_mgr.clone(),
            };
            tauri::async_runtime::spawn(start_http_server(server_state, 52431));

            // Start Clipboard Watcher Loop Task
            let app_handle = app.handle().clone();
            let clip_mgr = clipboard_mgr.clone();

            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(600));
                loop {
                    interval.tick().await;

                    // Infinite loop guard check
                    if clip_mgr.get_self_triggered() {
                        continue;
                    }

                    if let Ok(current_text) = clip_mgr.get_text() {
                        if current_text.trim().is_empty() {
                            continue;
                        }

                        if let Ok(mut last) = clip_mgr.last_text.lock() {
                            if *last != current_text {
                                *last = current_text.clone();
                                drop(last);

                                // Trigger bottom-right borderless micro-window popup
                                println!("[Clipboard Watcher] New copy detected: {}", current_text);
                                window_manager::show_micro_window(&app_handle, &current_text).ok();
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_clipboard_payload,
            dismiss_popup,
            get_local_ip,
            save_target_ip,
            show_popup_demo,
            get_device_code,
            request_device_pair,
            get_history,
            delete_history_item,
            clear_history,
            get_pending_requests,
            get_paired_devices,
            accept_request,
            reject_request,
            unpair_device
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri Windows P2P Clipboard application");
}
