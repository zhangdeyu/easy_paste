import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getExpiryDays, setExpiryDays, cleanupExpired } from '@/lib/api';

interface SettingsProps {
  onClearHistory?: () => Promise<void>;
  onCleanup?: () => Promise<void>;
}

export function Settings({ onClearHistory, onCleanup }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [isLoadingAutostart, setIsLoadingAutostart] = useState(false);
  const [expiryDays, setExpiryDaysState] = useState(30);
  const [isLoadingExpiry, setIsLoadingExpiry] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Check autostart status when dialog opens
  useEffect(() => {
    if (open) {
      checkAutostartStatus();
      loadExpiryDays();
      setCleanupMessage(null);
    }
  }, [open]);

  const checkAutostartStatus = async () => {
    try {
      const enabled = await invoke<boolean>('plugin:autostart|is_enabled');
      setAutostartEnabled(enabled);
    } catch (error) {
      console.error('Failed to check autostart status:', error);
    }
  };

  const loadExpiryDays = async () => {
    try {
      const days = await getExpiryDays();
      setExpiryDaysState(days);
    } catch (error) {
      console.error('Failed to load expiry days:', error);
    }
  };

  const toggleAutostart = async () => {
    setIsLoadingAutostart(true);
    try {
      if (autostartEnabled) {
        await invoke('plugin:autostart|disable');
        setAutostartEnabled(false);
      } else {
        await invoke('plugin:autostart|enable');
        setAutostartEnabled(true);
      }
    } catch (error) {
      console.error('Failed to toggle autostart:', error);
    } finally {
      setIsLoadingAutostart(false);
    }
  };

  const handleExpiryDaysChange = async (days: number) => {
    if (days < 1 || days > 365) return;
    setIsLoadingExpiry(true);
    try {
      await setExpiryDays(days);
      setExpiryDaysState(days);
    } catch (error) {
      console.error('Failed to set expiry days:', error);
    } finally {
      setIsLoadingExpiry(false);
    }
  };

  const handleCleanupExpired = async () => {
    setIsCleaningUp(true);
    setCleanupMessage(null);
    try {
      const count = await cleanupExpired();
      setCleanupMessage(`Cleaned up ${count} item${count !== 1 ? 's' : ''}`);
      if (onCleanup) {
        await onCleanup();
      }
    } catch (error) {
      console.error('Failed to cleanup expired items:', error);
      setCleanupMessage('Failed to cleanup');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleClearClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (onClearHistory) {
        await onClearHistory();
      }
      setConfirmOpen(false);
      setOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Open settings">
          <SettingsIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px] border-0 shadow-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-medium">Settings</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <div className="space-y-1">
            {/* Autostart */}
            <div className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm">Launch at Login</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Start when you log in
                </p>
              </div>
              <button
                onClick={toggleAutostart}
                disabled={isLoadingAutostart}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  autostartEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autostartEnabled ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>

            {/* Expiry Days */}
            <div className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors">
              <label htmlFor="expiry-days" className="cursor-pointer">
                <p className="text-sm">History Expiry</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Non-favorites expire after {expiryDays} days
                </p>
              </label>
              <input
                id="expiry-days"
                type="number"
                min={1}
                max={365}
                value={expiryDays}
                onChange={(e) => handleExpiryDaysChange(parseInt(e.target.value) || 30)}
                disabled={isLoadingExpiry}
                name="expiry-days"
                autoComplete="off"
                className="w-14 h-8 text-center text-sm border rounded-md bg-background px-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Clear Expired */}
            <div className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm">Cleanup Expired</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Delete expired items now
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCleanupExpired}
                disabled={isCleaningUp}
                className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
              >
                {isCleaningUp ? '…' : 'Cleanup'}
              </Button>
            </div>
            {cleanupMessage && (
              <p className="text-xs text-muted-foreground py-2">{cleanupMessage}</p>
            )}

            {/* Clear History */}
            <div className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm">Clear History</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Delete all clipboard items
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearClick}
                className="text-xs h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Clear
              </Button>
            </div>

            {/* Confirmation Dialog */}
            {confirmOpen && (
              <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/10 mt-2">
                <p className="text-sm font-medium mb-1">
                  Clear all history?
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmOpen(false)}
                    disabled={isClearing}
                    className="text-xs h-8 px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleConfirmClear}
                    disabled={isClearing}
                    className="text-xs h-8 px-3"
                  >
                    {isClearing ? 'Clearing…' : 'Clear'}
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 mt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Easy Paste v0.1.0
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}