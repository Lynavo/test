import { useCallback } from 'react';
import { BookOpen } from 'lucide-react';

const MAC_SHARING_GUIDE_URL =
  'https://support.apple.com/guide/mac-help/set-up-file-sharing-on-mac-mh17131/mac';

export function SystemGuideSection() {
  const handleOpen = useCallback(() => {
    window.open(MAC_SHARING_GUIDE_URL, '_blank');
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3">
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
    </div>
  );
}
