import { Link2 } from 'lucide-react';
import { CopyButton } from '@renderer/components/shared/CopyButton';
import { useSettingsStore } from '@renderer/stores/settings-store';

export function ShareAddressSection() {
  const shareAddress = useSettingsStore((s) => s.settings.shareAddress);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <label className="mb-2 block text-xs font-medium text-muted-foreground">
        共享地址（局域网）
      </label>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{shareAddress}</span>
        </div>
        <CopyButton
          text={shareAddress}
          label="复制"
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary"
        />
      </div>
    </div>
  );
}
