import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon } from 'lucide-react';

interface SettingsProps {
  onClearHistory?: () => void;
}

export function Settings({ onClearHistory }: SettingsProps) {
  const [open, setOpen] = useState(false);

  const handleClearHistory = () => {
    if (onClearHistory) {
      onClearHistory();
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clear History</p>
                <p className="text-xs text-muted-foreground">
                  Delete all clipboard history
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearHistory}
              >
                Clear
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">About</p>
              <p className="text-xs text-muted-foreground">
                Easy Paste v0.1.0
              </p>
              <p className="text-xs text-muted-foreground">
                A cross-platform clipboard manager
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}