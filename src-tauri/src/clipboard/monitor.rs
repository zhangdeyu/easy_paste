use arboard::Clipboard;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    pub fn start(app_handle: AppHandle) -> Self {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        thread::spawn(move || {
            let mut last_hash: Option<String> = None;

            while running_clone.load(Ordering::SeqCst) {
                if let Ok(mut clipboard) = Clipboard::new() {
                    // Try to read text first
                    if let Ok(text) = clipboard.get_text() {
                        let hash = Self::hash_content(&text);
                        if last_hash.as_ref() != Some(&hash) && !text.is_empty() {
                            last_hash = Some(hash.clone());
                            app_handle.emit("clipboard-changed", &text).ok();
                        }
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
        });

        Self { running }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    fn hash_content(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

pub fn read_clipboard_text() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

pub fn write_clipboard_text(content: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())
}