use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use rand::Rng;

use crate::crypto::sanitize_text;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PairedDevice {
    pub code: String,
    pub name: String,
    pub ip: String,
    pub trusted: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HistoryItem {
    pub id: String,
    pub text: String,
    pub sender: String,
    pub direction: String, // "sent" or "received"
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub device_code: String,
    pub device_name: String,
    pub transfers_count: u32,
    pub never_ask_again: bool,
    pub paired_devices: Vec<PairedDevice>,
    pub pending_requests: Vec<PairedDevice>,
    pub history: Vec<HistoryItem>,
    pub target_phone_ip: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut rng = rand::thread_rng();
        let code: String = (0..6)
            .map(|_| {
                let idx = rng.gen_range(0..36);
                let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                chars[idx] as char
            })
            .collect();

        Self {
            device_code: code,
            device_name: "CendroSync Windows PC".to_string(),
            transfers_count: 0,
            never_ask_again: false,
            paired_devices: Vec::new(),
            pending_requests: Vec::new(),
            history: Vec::new(),
            target_phone_ip: "192.168.1.100".to_string(),
        }
    }
}

#[derive(Clone)]
pub struct StorageManager {
    config_path: PathBuf,
    pub config: Arc<Mutex<AppConfig>>,
}

impl StorageManager {
    pub fn new() -> Self {
        let mut config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        config_dir.push("cendrosync");
        fs::create_dir_all(&config_dir).ok();
        let config_path = config_dir.join("config.json");

        let initial_config = if config_path.exists() {
            let data = fs::read_to_string(&config_path).unwrap_or_default();
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            let cfg = AppConfig::default();
            let _ = fs::write(&config_path, serde_json::to_string_pretty(&cfg).unwrap_or_default());
            cfg
        };

        Self {
            config_path,
            config: Arc::new(Mutex::new(initial_config)),
        }
    }

    pub fn save(&self) {
        if let Ok(cfg) = self.config.lock() {
            if let Ok(serialized) = serde_json::to_string_pretty(&*cfg) {
                let _ = fs::write(&self.config_path, serialized);
            }
        }
    }

    pub fn add_history_item(&self, mut item: HistoryItem) {
        item.text = sanitize_text(&item.text);
        if item.text.trim().is_empty() {
            return;
        }

        if let Ok(mut cfg) = self.config.lock() {
            cfg.history.insert(0, item);
            if cfg.history.len() > 50 {
                cfg.history.truncate(50);
            }
        }
        self.save();
    }

    pub fn get_history(&self) -> Vec<HistoryItem> {
        if let Ok(cfg) = self.config.lock() {
            return cfg
                .history
                .iter()
                .cloned()
                .map(|mut h| {
                    h.text = sanitize_text(&h.text);
                    h
                })
                .filter(|h| !h.text.trim().is_empty())
                .collect();
        }
        Vec::new()
    }

    pub fn delete_history_item(&self, id: &str) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.history.retain(|h| h.id != id);
        }
        self.save();
    }

    pub fn clear_history(&self) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.history.clear();
        }
        self.save();
    }

    #[allow(dead_code)]
    pub fn add_paired_device(&self, dev: PairedDevice) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.paired_devices.retain(|d| d.code != dev.code);
            cfg.paired_devices.push(dev);
        }
        self.save();
    }

    pub fn add_pending_request(&self, dev: PairedDevice) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.pending_requests.retain(|d| d.code != dev.code);
            cfg.pending_requests.push(dev);
        }
        self.save();
    }

    pub fn accept_pending_request(&self, code: &str) -> Option<PairedDevice> {
        let mut dev_to_move = None;
        if let Ok(mut cfg) = self.config.lock() {
            if let Some(pos) = cfg.pending_requests.iter().position(|d| d.code == code) {
                let mut dev = cfg.pending_requests.remove(pos);
                dev.trusted = true;
                dev_to_move = Some(dev.clone());
                cfg.paired_devices.retain(|d| d.code != code);
                cfg.paired_devices.push(dev);
            }
        }
        self.save();
        dev_to_move
    }

    pub fn reject_pending_request(&self, code: &str) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.pending_requests.retain(|d| d.code != code);
        }
        self.save();
    }

    pub fn remove_paired_device(&self, code: &str) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.paired_devices.retain(|d| d.code != code);
        }
        self.save();
    }

    pub fn increment_transfers(&self) -> Option<u32> {
        let mut cfg = self.config.lock().ok()?;
        cfg.transfers_count += 1;
        let count = cfg.transfers_count;
        let never_ask = cfg.never_ask_again;

        drop(cfg);
        self.save();

        if !never_ask && matches!(count, 10 | 30 | 50 | 100) {
            Some(count)
        } else {
            None
        }
    }

    pub fn set_never_ask_again(&self) {
        if let Ok(mut cfg) = self.config.lock() {
            cfg.never_ask_again = true;
        }
        self.save();
    }
}
