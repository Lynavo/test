import { useCallback } from 'react';
import { BookOpen, FolderOpen, Settings2 } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { useSettingsStore } from '@renderer/stores/settings-store';

const MAC_SHARING_GUIDE_URL =
  'https://support.apple.com/guide/mac-help/set-up-file-sharing-on-mac-mh17131/mac';
const WINDOWS_SHARING_SETTINGS_URI = 'ms-settings:network-advancedsettings';

export function SystemGuideSection() {
  const receivePath = useSettingsStore((s) => s.settings.receivePath);
  const isWindows = window.electronAPI?.platform.isWindows?.() ?? false;
  const handleOpen = useCallback(() => {
    void window.electronAPI?.files.openExternal(MAC_SHARING_GUIDE_URL);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <button
          onClick={handleOpen}
          className="flex cursor-pointer items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-secondary/80 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2"
        >
          <BookOpen className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Mac 开启本地共享操作手册
            </p>
            <p className="text-xs text-muted-foreground">
              适用于 macOS Ventura 及以上
            </p>
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground">
            Windows 手动配置共享方法
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            当前 Windows 版本暂未支持自动检测共享状态，请按下面步骤手动配置 SMB 共享。
          </p>
        </div>

        {isWindows ? (
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void window.electronAPI?.files.openExternal(WINDOWS_SHARING_SETTINGS_URI)}
            >
              <Settings2 className="h-4 w-4" />
              打开高级共享设置
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void window.electronAPI?.files.openFolder(receivePath)}
              disabled={!receivePath}
            >
              <FolderOpen className="h-4 w-4" />
              打开接收目录
            </Button>
          </div>
        ) : null}

        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>1. 打开“设置 → 网络和 Internet → 高级网络设置 → 高级共享设置”。</li>
          <li>2. 开启“网络发现”和“文件和打印机共享”。</li>
          <li>3. 右键接收目录，进入“属性 → 共享 → 高级共享”，勾选“共享此文件夹”。</li>
          <li>4. 记录共享名，并确认本机在局域网中的电脑名或 IP 地址。</li>
          <li>5. 共享地址格式通常为 `\\\\电脑名\\共享名`，确认后再回到应用里重新检测。</li>
        </ol>
      </div>
    </div>
  );
}
