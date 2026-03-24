import { useCallback, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import { CopyButton } from '@renderer/components/shared/CopyButton';
import { useSettingsStore } from '@renderer/stores/settings-store';

export function FilePathSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const receivePath = settings.receivePath;
  const [saving, setSaving] = useState(false);

  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await window.electronAPI.files.selectFolder();
      if (selected && selected !== receivePath) {
        setSaving(true);
        const updated = await window.electronAPI.sidecar.updateSettings({
          receivePath: selected,
        });
        updateSettings(updated);
      }
    } catch {
      toast.error('保存接收路径失败');
    } finally {
      setSaving(false);
    }
  }, [receivePath, updateSettings]);

  const handleOpenFolder = useCallback(async () => {
    if (!receivePath) {
      toast.error('当前还没有可打开的接收路径');
      return;
    }
    try {
      await window.electronAPI.files.openFolder(receivePath);
    } catch {
      toast.error('打开文件夹失败');
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
          disabled={saving}
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
        disabled={!receivePath}
      >
        <FolderOpen className="h-4 w-4" />
        打开文件夹
      </Button>
    </div>
  );
}
