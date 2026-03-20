import { BookOpen } from 'lucide-react';

export function SystemGuideSection() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <button className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left transition-colors hover:bg-secondary/80">
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
