import { useState, useEffect, useRef, useCallback } from 'react';
import { useHistory } from '@/hooks/useHistory';
import { useClipboardListener } from '@/hooks/useClipboardListener';
import { copyToClipboard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        <div className="flex items-center gap-3">
          <img
            src={`data:image/png;base64,${item.image_data}`}
            alt="Clipboard image"
            width={40}
            height={40}
            className="w-10 h-10 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity motion-reduce:transition-none"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(item.image_data!);
            }}
          />
          <span className="text-sm text-muted-foreground">{item.preview}</span>
        </div>
      );
    }
    return <p className="text-sm leading-relaxed line-clamp-2">{item.preview}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-medium tracking-tight">Easy Paste</h1>
          <div className="flex items-center gap-0.5">
            {isSelectMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
                >
                  {selectedIds.size === filteredItems.length ? 'Unselect all' : 'Select all'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="text-xs h-8 px-3 text-destructive hover:text-destructive"
                >
                  Delete {selectedIds.size > 0 ? selectedIds.size : ''}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitSelectMode}
                  className="text-xs h-8 px-3"
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSelectMode(true)}
                  className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
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
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          name="search"
          autoComplete="off"
          className="h-10 text-sm"
        />
        {/* Filter buttons */}
        <div className="flex gap-1 mt-3">
          {(['all', 'text', 'image'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {f === 'all' ? 'All' : f === 'text' ? 'Text' : 'Images'}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1 px-5">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? 'No clipboard history yet'
              : 'No matching items'}
          </div>
        ) : (
          <div className="space-y-1.5 pb-4" ref={listRef}>
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`group relative px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  index === selectedIndex && !isSelectMode
                    ? 'bg-muted'
                    : 'hover:bg-muted/60'
                } ${selectedIds.has(item.id) ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                onClick={() => handleCopy(item)}
                onMouseEnter={() => !isSelectMode && setSelectedIndex(index)}
              >
                <div className="flex items-start gap-3">
                  {isSelectMode && (
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    {renderPreview(item)}
                    <p className="text-[11px] text-muted-foreground/70 mt-1 tracking-wide">
                      {formatTime(item.updated_at)}
                    </p>
                  </div>
                  {!isSelectMode && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity motion-reduce:transition-none">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <span className="text-sm">{item.is_favorite ? '★' : '☆'}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete item"
                      >
                        <span className="text-sm">×</span>
                      </button>
                    </div>
                  )}
                </div>
                {copiedId === item.id && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium" aria-live="polite">
                    Copied
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <footer className="px-5 py-3 text-center">
        <p className="text-[11px] text-muted-foreground/60 tracking-wide">
          {isSelectMode
            ? `${selectedIds.size} selected`
            : `${filteredItems.length} items · Esc to hide`}
        </p>
      </footer>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden border-0 shadow-2xl">
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