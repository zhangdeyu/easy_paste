use chrono::Utc;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;

/// Default expiry days for non-favorite items
pub const DEFAULT_EXPIRY_DAYS: i64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: ContentType,
    pub text_content: Option<String>,
    pub image_data: Option<String>,
    pub file_path: Option<String>,
    pub preview: String,
    pub is_favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentType {
    Text,
    Image,
}

impl ContentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ContentType::Text => "text",
            ContentType::Image => "image",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "image" => ContentType::Image,
            _ => ContentType::Text,
        }
    }
}

#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Result of inserting a clipboard item
#[derive(Debug, Clone)]
pub enum InsertResult {
    /// New item was inserted
    Inserted(ClipboardItem),
    /// Existing item was updated (updated_at changed)
    Updated(ClipboardItem),
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: &Path) -> Result<Self, DatabaseError> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("clipboard.db");
        let conn = Connection::open(db_path)?;

        // Create table with all columns
        conn.execute(
            "CREATE TABLE IF NOT EXISTS clipboard_items (
                id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                text_content TEXT,
                image_data TEXT,
                file_path TEXT,
                preview TEXT,
                is_favorite INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER
            )",
            [],
        )?;

        // Migration: Add updated_at column if it doesn't exist
        conn.execute(
            "ALTER TABLE clipboard_items ADD COLUMN updated_at INTEGER",
            [],
        ).ok(); // Ignore error if column already exists

        // Migration: Add file_path column if it doesn't exist
        conn.execute(
            "ALTER TABLE clipboard_items ADD COLUMN file_path TEXT",
            [],
        ).ok(); // Ignore error if column already exists

        // Set updated_at = created_at for existing rows where updated_at is NULL
        conn.execute(
            "UPDATE clipboard_items SET updated_at = created_at WHERE updated_at IS NULL",
            [],
        ).ok();

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_updated_at ON clipboard_items(updated_at DESC)",
            [],
        )?;

        // Add index for file_path to speed up path-based lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_file_path ON clipboard_items(file_path)",
            [],
        ).ok();

        // Create settings table for storing app configuration
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Insert default expiry days if not exists
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('expiry_days', ?1)",
            params![DEFAULT_EXPIRY_DAYS.to_string()],
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Get expiry days setting
    pub fn get_expiry_days(&self) -> Result<i64, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let value: String = conn.query_row(
            "SELECT value FROM settings WHERE key = 'expiry_days'",
            [],
            |row| row.get(0),
        )?;
        Ok(value.parse().unwrap_or(DEFAULT_EXPIRY_DAYS))
    }

    /// Set expiry days setting
    pub fn set_expiry_days(&self, days: i64) -> Result<(), DatabaseError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('expiry_days', ?1)",
            params![days.to_string()],
        )?;
        Ok(())
    }

    /// Delete expired items (non-favorite only)
    /// Returns the number of deleted items
    pub fn delete_expired(&self) -> Result<usize, DatabaseError> {
        // Get expiry days first (this acquires and releases the lock)
        let expiry_days = self.get_expiry_days()?;
        let expiry_timestamp = Utc::now().timestamp() - (expiry_days * 24 * 60 * 60);

        // Then acquire lock for delete operation
        let conn = self.conn.lock().unwrap();
        let rows_deleted = conn.execute(
            "DELETE FROM clipboard_items WHERE is_favorite = 0 AND updated_at < ?1",
            params![expiry_timestamp],
        )?;
        Ok(rows_deleted)
    }

    /// Delete multiple items by IDs
    /// Returns the number of deleted items
    pub fn delete_batch(&self, ids: &[String]) -> Result<usize, DatabaseError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let conn = self.conn.lock().unwrap();
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "DELETE FROM clipboard_items WHERE id IN ({})",
            placeholders.join(",")
        );

        let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let rows_deleted = conn.execute(&sql, params.as_slice())?;
        Ok(rows_deleted)
    }

    /// Insert or update clipboard item based on content
    /// - If content doesn't exist: insert new item with created_at = updated_at = now
    /// - If content exists: update updated_at = now, keep original created_at
    /// - For images: if file_path exists, compare by path first, then by content
    pub fn insert(&self, item: &ClipboardItem) -> Result<InsertResult, DatabaseError> {
        let conn = self.conn.lock().unwrap();

        // Check if same content already exists
        // For images with path: check path first, then fall back to content comparison
        let existing: Option<(String, i64)> = if item.content_type == ContentType::Image {
            // For image type: check by path first if available
            if let Some(ref path) = item.file_path {
                if !path.is_empty() {
                    // Try to find by path first
                    let by_path = conn.query_row(
                        "SELECT id, created_at FROM clipboard_items
                         WHERE file_path = ?1 AND file_path != ''
                         LIMIT 1",
                        params![path],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    ).ok();

                    if by_path.is_some() {
                        by_path
                    } else {
                        // Path not found, check by content
                        conn.query_row(
                            "SELECT id, created_at FROM clipboard_items
                             WHERE ?1 != '' AND image_data = ?1
                             LIMIT 1",
                            params![item.image_data.as_deref().unwrap_or("")],
                            |row| Ok((row.get(0)?, row.get(1)?)),
                        ).ok()
                    }
                } else {
                    // No path, check by content
                    conn.query_row(
                        "SELECT id, created_at FROM clipboard_items
                         WHERE ?1 != '' AND image_data = ?1
                         LIMIT 1",
                        params![item.image_data.as_deref().unwrap_or("")],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    ).ok()
                }
            } else {
                // No path, check by content
                conn.query_row(
                    "SELECT id, created_at FROM clipboard_items
                     WHERE ?1 != '' AND image_data = ?1
                     LIMIT 1",
                    params![item.image_data.as_deref().unwrap_or("")],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                ).ok()
            }
        } else {
            // For text type: check by text content
            conn.query_row(
                "SELECT id, created_at FROM clipboard_items
                 WHERE ?1 != '' AND text_content = ?1
                 LIMIT 1",
                params![item.text_content.as_deref().unwrap_or("")],
                |row| Ok((row.get(0)?, row.get(1)?)),
            ).ok()
        };

        if let Some((existing_id, original_created_at)) = existing {
            // Content exists - update updated_at only
            let updated_at = Utc::now().timestamp();
            conn.execute(
                "UPDATE clipboard_items SET updated_at = ?1 WHERE id = ?2",
                params![updated_at, existing_id],
            )?;

            // Return updated item with original created_at
            let updated_item = ClipboardItem {
                id: existing_id,
                content_type: item.content_type.clone(),
                text_content: item.text_content.clone(),
                image_data: item.image_data.clone(),
                file_path: item.file_path.clone(),
                preview: item.preview.clone(),
                is_favorite: item.is_favorite,
                created_at: original_created_at,
                updated_at,
            };
            return Ok(InsertResult::Updated(updated_item));
        }

        // New content - insert with created_at = updated_at
        conn.execute(
            "INSERT INTO clipboard_items (id, content_type, text_content, image_data, file_path, preview, is_favorite, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &item.id,
                item.content_type.as_str(),
                item.text_content.as_deref().unwrap_or(""),
                item.image_data.as_deref().unwrap_or(""),
                item.file_path.as_deref().unwrap_or(""),
                &item.preview,
                item.is_favorite as i32,
                item.created_at,
                item.updated_at,
            ],
        )?;
        Ok(InsertResult::Inserted(item.clone()))
    }

    pub fn get_all(&self, limit: i64, offset: i64) -> Result<Vec<ClipboardItem>, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, image_data, file_path, preview, is_favorite, created_at, updated_at
             FROM clipboard_items
             ORDER BY updated_at DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let items = stmt
            .query_map(params![limit, offset], |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&row.get::<_, String>(1)?),
                    text_content: row.get(2)?,
                    image_data: row.get(3)?,
                    file_path: row.get(4)?,
                    preview: row.get(5)?,
                    is_favorite: row.get::<_, i32>(6)? == 1,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(items)
    }

    pub fn search(&self, query: &str, limit: i64) -> Result<Vec<ClipboardItem>, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, image_data, file_path, preview, is_favorite, created_at, updated_at
             FROM clipboard_items
             WHERE text_content LIKE ?1
             ORDER BY updated_at DESC
             LIMIT ?2",
        )?;

        let search_pattern = format!("%{}%", query);
        let items = stmt
            .query_map(params![search_pattern, limit], |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&row.get::<_, String>(1)?),
                    text_content: row.get(2)?,
                    image_data: row.get(3)?,
                    file_path: row.get(4)?,
                    preview: row.get(5)?,
                    is_favorite: row.get::<_, i32>(6)? == 1,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(items)
    }

    pub fn get_by_id(&self, id: &str) -> Result<Option<ClipboardItem>, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, image_data, file_path, preview, is_favorite, created_at, updated_at
             FROM clipboard_items WHERE id = ?1",
        )?;

        let mut items = stmt
            .query_map(params![id], |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&row.get::<_, String>(1)?),
                    text_content: row.get(2)?,
                    image_data: row.get(3)?,
                    file_path: row.get(4)?,
                    preview: row.get(5)?,
                    is_favorite: row.get::<_, i32>(6)? == 1,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(items.pop())
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<(), DatabaseError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE clipboard_items SET is_favorite = NOT is_favorite WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<(), DatabaseError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<usize, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let rows_deleted = conn.execute("DELETE FROM clipboard_items", [])?;
        Ok(rows_deleted)
    }
}

/// Helper function to create a new clipboard item
pub fn create_clipboard_item(
    content_type: ContentType,
    text_content: Option<String>,
    image_data: Option<String>,
    file_path: Option<String>,
) -> ClipboardItem {
    let now = Utc::now().timestamp();
    let preview = match &text_content {
        Some(text) => text.chars().take(100).collect(),
        None => "[Image]".to_string(),
    };

    ClipboardItem {
        id: uuid::Uuid::new_v4().to_string(),
        content_type,
        text_content,
        image_data,
        file_path,
        preview,
        is_favorite: false,
        created_at: now,
        updated_at: now,
    }
}