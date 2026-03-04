use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Error)]
pub enum PositionError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub struct WindowPositionStore {
    path: PathBuf,
}

impl WindowPositionStore {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        let path = app_data_dir.join("window_position.json");
        Self { path }
    }

    pub fn load(&self) -> Option<WindowPosition> {
        if !self.path.exists() {
            return None;
        }
        let content = fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn save(&self, position: &WindowPosition) -> Result<(), PositionError> {
        let content = serde_json::to_string_pretty(position)?;
        fs::write(&self.path, content)?;
        Ok(())
    }
}