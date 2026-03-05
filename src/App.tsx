import { useState, useEffect, useRef, useCallback } from 'react';
import { useHistory } from '@/hooks/useHistory';
import { useClipboardListener } from '@/hooks/useClipboardListener';
import { copyToClipboard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Settings } from '@/components/Settings';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import type { ClipboardItem, ContentType } from '@/types/clipboard';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Checkbox } from '@/components/ui/checkbox';

type FilterType = 'all' | ContentType;

async function saveWindowPosition() {
  const window = getCurrentWindow();
  const position = await window.outerPosition();
  await invoke('save_window_position', { x: position.x, y: position.y });
}

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const { items, isLoading, search, toggleFavorite, deleteItem, deleteBatch, addItem, clearHistory, refresh } = useHistory();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Multi-select mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter items based on content type
  const filteredItems = filter === 'all'
    ? items
    : items.filter(item => item.content_type === filter);

  // Listen for clipboard changes - backend now saves to DB and sends ClipboardItem
  useClipboardListener((item: ClipboardItem) => {
    addItem(item);
  });

  // Handle copy action
  const handleCopy = useCallback(async (item: ClipboardItem) => {
    if (isSelectMode) {
      toggleSelection(item.id);
      return;
    }
    const content = item.content_type === 'image' ? item.image_data : item.text_content;
    if (content) {
      await copyToClipboard(content, item.content_type);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [isSelectMode]);

  // Toggle selection for multi-select mode
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  }, [filteredItems, selectedIds.size]);

  // Delete selected items
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await deleteBatch(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, [selectedIds, deleteBatch]);

  // Exit select mode
  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if typing in input
    if (document.activeElement === inputRef.current) {
      if (e.key === 'Escape') {
        (document.activeElement as HTMLInputElement).blur();
      }
      return;
    }

    // Handle escape in select mode
    if (e.key === 'Escape' && isSelectMode) {
      exitSelectMode();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          handleCopy(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        saveWindowPosition();
        getCurrentWindow().hide();
        break;
    }
  }, [filteredItems, selectedIndex, handleCopy, isSelectMode, exitSelectMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Reset selection when items or filter change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [items.length, filter]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    search(query);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderPreview = (item: ClipboardItem) => {
    if (item.content_type === 'image' && item.image_data) {
      return (
        <div className="flex items-center gap-2">
          <img
            src={`data:image/png;base64,${item.image_data}`}
            alt="Clipboard image"
            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(item.image_data!);
            }}
          />
          <span className="text-sm text-muted-foreground">{item.preview}</span>
        </div>
      );
    }
    return <p className="text-sm truncate">{item.preview}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Easy Paste</h1>
          <div className="flex items-center gap-1">
            {isSelectMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-xs h-7"
                >
                  {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="text-xs h-7"
                >
                  Delete ({selectedIds.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitSelectMode}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectMode(true)}
                  className="text-xs h-7"
                >
                  Select
                </Button>
                <Settings onClearHistory={clearHistory} onCleanup={refresh} />
              </>
            )}
          </div>
        </div>
        <Input
          ref={inputRef}
          placeholder="Search clipboard history..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {/* Filter buttons */}
        <div className="flex gap-1 mt-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs h-7"
          >
            All
          </Button>
          <Button
            variant={filter === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('text')}
            className="text-xs h-7"
          >
            Text
          </Button>
          <Button
            variant={filter === 'image' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('image')}
            className="text-xs h-7"
          >
            Images
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {items.length === 0
              ? 'No clipboard history yet. Copy some text or image to get started.'
              : 'No items match the current filter.'}
          </div>
        ) : (
          <div className="divide-y divide-border" ref={listRef}>
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`p-3 cursor-pointer group ${
                  index === selectedIndex
                    ? 'bg-accent'
                    : 'hover:bg-accent/50'
                } ${selectedIds.has(item.id) ? 'bg-primary/10' : ''}`}
                onClick={() => handleCopy(item)}
                onMouseEnter={() => !isSelectMode && setSelectedIndex(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {isSelectMode && (
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {renderPreview(item)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(item.updated_at)}
                      </p>
                    </div>
                  </div>
                  {!isSelectMode && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                      >
                        {item.is_favorite ? '★' : '☆'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                </div>
                {copiedId === item.id && (
                  <p className="text-xs text-green-500 mt-1">Copied!</p>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="p-2 text-xs text-center text-muted-foreground">
        {isSelectMode
          ? `${selectedIds.size} selected · Click to toggle selection`
          : `${filteredItems.length} items · Click to copy · ↑↓ Navigate · Enter Copy · Esc Hide`}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {previewImage && (
            <img
              src={`data:image/png;base64,${previewImage}`}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;