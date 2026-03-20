import { useCallback } from 'react';
import { FolderOpen } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import { CopyButton } from '@renderer/components/shared/CopyButton';
import { useSettingsStore } from '@renderer/stores/settings-store';

export function FilePathSection() {
  const settings = useSettingsStore((s) => s.settings);
  const receivePath = settings.receivePath;

  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await window.electronAPI.files.selectFolder();
      if (selected) {
        // Phase 1: read-only display; will wire to updateSettings when backend is ready
      }
    } catch {
      // silent fail
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    try {
      await window.electronAPI.files.openFolder(receivePath);
    } catch {
      // silent fail
    }
  }, [receivePath]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <label className="mb-2 block text-xs font-medium text-muted-foreground">
        接收地址
      </label>
      <div className="mb-3 flex items-center gap-2">
        <Input
          type="text"
          value={receivePath}
          readOnly
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleSelectFolder}
          aria-label="选择文件夹"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <CopyButton
          text={receivePath}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenFolder}
      >
        <FolderOpen className="h-4 w-4" />
        打开文件夹
      </Button>
    </div>
  );
}
