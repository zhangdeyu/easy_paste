use crate::clipboard::write_clipboard_text;
use crate::database::models::{create_clipboard_item, ClipboardItem, ContentType, Database};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_history(
    db: State<'_, Arc<Database>>,
    limit: i64,
    offset: i64,
) -> Result<Vec<ClipboardItem>, String> {
    db.get_all(limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_history(
    db: State<'_, Arc<Database>>,
    query: String,
    limit: i64,
) -> Result<Vec<ClipboardItem>, String> {
    db.search(&query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_item(
    db: State<'_, Arc<Database>>,
    id: String,
) -> Result<Option<ClipboardItem>, String> {
    db.get_by_id(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_item(db: State<'_, Arc<Database>>, id: String) -> Result<(), String> {
    db.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_favorite(db: State<'_, Arc<Database>>, id: String) -> Result<(), String> {
    db.toggle_favorite(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn copy_to_clipboard(content: String) -> Result<(), String> {
    write_clipboard_text(&content)
}

#[tauri::command]
pub async fn save_clipboard(
    db: State<'_, Arc<Database>>,
    content: String,
) -> Result<ClipboardItem, String> {
    let item = create_clipboard_item(ContentType::Text, Some(content), None);
    db.insert(&item).map_err(|e| e.to_string())?;
    Ok(item)
}