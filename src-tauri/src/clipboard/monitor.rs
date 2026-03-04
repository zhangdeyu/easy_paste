use arboard::Clipboard;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::database::models::{ClipboardItem, ContentType, Database};

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    pub fn start(app_handle: AppHandle, db: Arc<Database>) -> Self {
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

                            // Save to database
                            let item = Self::create_text_item(&text);
                            if let Err(e) = db.insert(&item) {
                                eprintln!("Failed to save clipboard item: {}", e);
                            }

                            // Emit event to frontend
                            app_handle.emit("clipboard-changed", &item).ok();
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

    fn create_text_item(text: &str) -> ClipboardItem {
        let preview: String = text.chars().take(100).collect();
        ClipboardItem {
            id: Uuid::new_v4().to_string(),
            content_type: ContentType::Text,
            text_content: Some(text.to_string()),
            image_data: None,
            preview,
            is_favorite: false,
            created_at: Utc::now().timestamp(),
        }
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