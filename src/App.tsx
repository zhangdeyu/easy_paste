import { useState } from 'react';
import { useHistory } from '@/hooks/useHistory';
import { useClipboardListener } from '@/hooks/useClipboardListener';
import { copyToClipboard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { ClipboardItem } from '@/types/clipboard';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const { items, isLoading, search, toggleFavorite, deleteItem, addItem } = useHistory();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Listen for clipboard changes - backend now saves to DB and sends ClipboardItem
  useClipboardListener((item: ClipboardItem) => {
    addItem(item);
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    search(query);
  };

  const handleCopy = async (item: ClipboardItem) => {
    const content = item.content_type === 'image' ? item.image_data : item.text_content;
    if (content) {
      await copyToClipboard(content, item.content_type);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
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
            className="w-12 h-12 object-cover rounded border"
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
        <h1 className="text-lg font-semibold mb-3">Easy Paste</h1>
        <Input
          placeholder="Search clipboard history..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No clipboard history yet. Copy some text or image to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-accent/50 cursor-pointer group"
                onClick={() => handleCopy(item)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {renderPreview(item)}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(item.created_at)}
                    </p>
                  </div>
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
        {items.length} items · Click to copy
      </div>
    </div>
  );
}

export default App;