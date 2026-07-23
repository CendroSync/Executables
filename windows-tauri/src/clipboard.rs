use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct ClipboardManager {
    /// Strict Infinite Loop Guard state lock.
    /// When true, incoming clipboard updates from the phone are ignored by the local watcher.
    pub is_self_triggered: Arc<AtomicBool>,
    pub last_text: Arc<Mutex<String>>,
}

impl ClipboardManager {
    pub fn new() -> Self {
        Self {
            is_self_triggered: Arc::new(AtomicBool::new(false)),
            last_text: Arc::new(Mutex::new(String::new())),
        }
    }

    pub fn set_self_triggered(&self, val: bool) {
        self.is_self_triggered.store(val, Ordering::SeqCst);
    }

    pub fn get_self_triggered(&self) -> bool {
        self.is_self_triggered.load(Ordering::SeqCst)
    }

    pub fn get_text(&self) -> Result<String, String> {
        let mut board = Clipboard::new().map_err(|e| e.to_string())?;
        let text = board.get_text().map_err(|e| e.to_string())?;
        Ok(crate::crypto::sanitize_text(&text))
    }

    pub fn set_text(&self, text: &str) -> Result<(), String> {
        let clean_text = crate::crypto::sanitize_text(text);
        if clean_text.trim().is_empty() {
            return Ok(());
        }

        // Update last_text so the clipboard watcher knows this text is already synced
        if let Ok(mut last) = self.last_text.lock() {
            *last = clean_text.clone();
        }

        // Set self-triggered lock TRUE before updating system clipboard
        self.set_self_triggered(true);

        let mut board = Clipboard::new().map_err(|e| e.to_string())?;
        let res = board.set_text(clean_text).map_err(|e| e.to_string());

        // Briefly wait then release self-triggered lock
        let lock_ref = self.is_self_triggered.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
            lock_ref.store(false, Ordering::SeqCst);
        });

        res
    }
}

