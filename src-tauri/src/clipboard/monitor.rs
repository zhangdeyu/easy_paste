use arboard::Clipboard;
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::database::models::{ClipboardItem, ContentType, Database, InsertResult};

/// Global state to skip the next clipboard content that we just wrote
static SKIP_HASH: once_cell::sync::Lazy<Arc<Mutex<Option<String>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Mark a hash to be skipped on next clipboard change detection
pub fn set_skip_hash(hash: String) {
    if let Ok(mut guard) = SKIP_HASH.lock() {
        *guard = Some(hash);
    }
}

/// Hash text content
fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Hash binary content
fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// Check if this hash should be skipped (we just wrote it to clipboard)
fn should_skip(hash: &str) -> bool {
    if let Ok(mut guard) = SKIP_HASH.lock() {
        if let Some(skip_hash) = guard.take() {
            return skip_hash == hash;
        }
    }
    false
}

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    pub fn start(app_handle: AppHandle, db: Arc<Database>) -> Self {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        thread::spawn(move || {
            // Initialize last hash from current clipboard content
            // This prevents saving the existing clipboard content on startup
            let mut last_hash: Option<String> = {
                if let Ok(mut clipboard) = Clipboard::new() {
                    if let Ok(image) = clipboard.get_image() {
                        Some(hash_bytes(&image.bytes))
                    } else if let Ok(text) = clipboard.get_text() {
                        if !text.is_empty() {
                            Some(hash_content(&text))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            };

            while running_clone.load(Ordering::SeqCst) {
                if let Ok(mut clipboard) = Clipboard::new() {
                    // Try to read image first, then text
                    let (hash, item_result) = if let Ok(image) = clipboard.get_image() {
                        let hash = hash_bytes(&image.bytes);
                        let item = Self::create_image_item(&image.bytes, image.width, image.height);
                        (Some(hash), Some(item))
                    } else if let Ok(text) = clipboard.get_text() {
                        if text.is_empty() {
                            (None, None)
                        } else {
                            let hash = hash_content(&text);
                            let item = Self::create_text_item(&text);
                            (Some(hash), Some(item))
                        }
                    } else {
                        (None, None)
                    };

                    if let (Some(hash), Some(item)) = (hash, item_result) {
                        // Skip if we just wrote this content
                        if should_skip(&hash) {
                            last_hash = Some(hash);
                        }
                        // Only save if content changed
                        else if last_hash.as_ref() != Some(&hash) {
                            last_hash = Some(hash);

                            // Insert or update in database
                            match db.insert(&item) {
                                Ok(InsertResult::Inserted(new_item)) => {
                                    app_handle.emit("clipboard-changed", &new_item).ok();
                                }
                                Ok(InsertResult::Updated(updated_item)) => {
                                    app_handle.emit("clipboard-changed", &updated_item).ok();
                                }
                                Err(e) => {
                                    eprintln!("Failed to save clipboard item: {}", e);
                                }
                            }
                        }
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
        });

        Self { running }
    }

    fn create_text_item(text: &str) -> ClipboardItem {
        let now = Utc::now().timestamp();
        let preview: String = text.chars().take(100).collect();
        ClipboardItem {
            id: Uuid::new_v4().to_string(),
            content_type: ContentType::Text,
            text_content: Some(text.to_string()),
            image_data: None,
            preview,
            is_favorite: false,
            created_at: now,
            updated_at: now,
        }
    }

    fn create_image_item(bytes: &[u8], width: usize, height: usize) -> ClipboardItem {
        let now = Utc::now().timestamp();
        let image_data = STANDARD.encode(bytes);
        let preview = format!("[Image {}x{}]", width, height);
        ClipboardItem {
            id: Uuid::new_v4().to_string(),
            content_type: ContentType::Image,
            text_content: None,
            image_data: Some(image_data),
            preview,
            is_favorite: false,
            created_at: now,
            updated_at: now,
        }
    }
}

pub fn write_clipboard_text(content: &str) -> Result<(), String> {
    // Set skip hash before writing so monitor won't detect our own write
    set_skip_hash(hash_content(content));

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())
}

pub fn write_clipboard_image(base64_data: &str) -> Result<(), String> {
    let bytes = STANDARD.decode(base64_data).map_err(|e| e.to_string())?;

    // Set skip hash before writing so monitor won't detect our own write
    set_skip_hash(hash_bytes(&bytes));

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    let image = arboard::ImageData {
        bytes: bytes.into(),
        width: 0,
        height: 0,
    };

    clipboard.set_image(image).map_err(|e| e.to_string())
}