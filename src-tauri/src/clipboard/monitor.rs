use arboard::Clipboard;
use base64::{engine::general_purpose::STANDARD, Engine};
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
            let mut last_text_hash: Option<String> = None;
            let mut last_image_hash: Option<String> = None;

            while running_clone.load(Ordering::SeqCst) {
                if let Ok(mut clipboard) = Clipboard::new() {
                    // Try to read image first (images are less common, but more specific)
                    if let Ok(image) = clipboard.get_image() {
                        let hash = Self::hash_bytes(&image.bytes);
                        if last_image_hash.as_ref() != Some(&hash) {
                            last_image_hash = Some(hash);
                            last_text_hash = None; // Reset text hash when image is copied

                            // Convert to base64
                            let image_data = STANDARD.encode(&image.bytes);

                            // Save to database
                            let item = Self::create_image_item(&image_data, image.width, image.height);
                            if let Err(e) = db.insert(&item) {
                                eprintln!("Failed to save clipboard image: {}", e);
                            }

                            // Emit event to frontend
                            app_handle.emit("clipboard-changed", &item).ok();
                        }
                    } else if let Ok(text) = clipboard.get_text() {
                        // Fallback to text
                        let hash = Self::hash_content(&text);
                        if last_text_hash.as_ref() != Some(&hash) && !text.is_empty() {
                            last_text_hash = Some(hash.clone());
                            last_image_hash = None; // Reset image hash when text is copied

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

    fn hash_bytes(bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
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

    fn create_image_item(image_data: &str, width: usize, height: usize) -> ClipboardItem {
        let preview = format!("[Image {}x{}]", width, height);
        ClipboardItem {
            id: Uuid::new_v4().to_string(),
            content_type: ContentType::Image,
            text_content: None,
            image_data: Some(image_data.to_string()),
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

pub fn write_clipboard_image(base64_data: &str) -> Result<(), String> {
    let bytes = STANDARD.decode(base64_data).map_err(|e| e.to_string())?;
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    // Create ImageData from bytes (assuming RGBA format)
    // For simplicity, we'll set dimensions to 0 and let the clipboard handle it
    let image = arboard::ImageData {
        bytes: bytes.into(),
        width: 0,
        height: 0,
    };

    clipboard.set_image(image).map_err(|e| e.to_string())
}