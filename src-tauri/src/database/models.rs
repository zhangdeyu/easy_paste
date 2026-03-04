use chrono::Utc;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: String,
    pub content_type: ContentType,
    pub text_content: Option<String>,
    pub image_data: Option<String>,
    pub preview: String,
    pub is_favorite: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: &Path) -> Result<Self, DatabaseError> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("clipboard.db");
        let conn = Connection::open(db_path)?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS clipboard_items (
                id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                text_content TEXT,
                image_data TEXT,
                preview TEXT,
                is_favorite INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_created_at ON clipboard_items(created_at DESC)",
            [],
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert(&self, item: &ClipboardItem) -> Result<(), DatabaseError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO clipboard_items (id, content_type, text_content, image_data, preview, is_favorite, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                &item.id,
                item.content_type.as_str(),
                item.text_content.as_deref().unwrap_or(""),
                item.image_data.as_deref().unwrap_or(""),
                &item.preview,
                item.is_favorite as i32,
                item.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_all(&self, limit: i64, offset: i64) -> Result<Vec<ClipboardItem>, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, image_data, preview, is_favorite, created_at
             FROM clipboard_items
             ORDER BY created_at DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let items = stmt
            .query_map(params![limit, offset], |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&row.get::<_, String>(1)?),
                    text_content: row.get(2)?,
                    image_data: row.get(3)?,
                    preview: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? == 1,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(items)
    }

    pub fn search(&self, query: &str, limit: i64) -> Result<Vec<ClipboardItem>, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, image_data, preview, is_favorite, created_at
             FROM clipboard_items
             WHERE text_content LIKE ?1
             ORDER BY created_at DESC
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
                    preview: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? == 1,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(items)
    }

    pub fn get_by_id(&self, id: &str) -> Result<Option<ClipboardItem>, DatabaseError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, image_data, preview, is_favorite, created_at
             FROM clipboard_items WHERE id = ?1",
        )?;

        let mut items = stmt
            .query_map(params![id], |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    content_type: ContentType::from_str(&row.get::<_, String>(1)?),
                    text_content: row.get(2)?,
                    image_data: row.get(3)?,
                    preview: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? == 1,
                    created_at: row.get(6)?,
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
}

pub fn create_clipboard_item(content_type: ContentType, text_content: Option<String>, image_data: Option<String>) -> ClipboardItem {
    let preview = match &text_content {
        Some(text) => text.chars().take(100).collect(),
        None => "[Image]".to_string(),
    };

    ClipboardItem {
        id: Uuid::new_v4().to_string(),
        content_type,
        text_content,
        image_data,
        preview,
        is_favorite: false,
        created_at: Utc::now().timestamp(),
    }
}