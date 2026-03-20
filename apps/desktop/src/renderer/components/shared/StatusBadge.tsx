import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/utils';
import type { DeviceDashboardStatus } from '@syncflow/contracts';

const dotVariants = cva('h-2 w-2 rounded-full', {
  variants: {
    status: {
      transferring: 'bg-blue-500 animate-pulse',
      connected_idle: 'bg-green-500',
      offline: 'bg-gray-400',
    },
  },
  defaultVariants: {
    status: 'offline',
  },
});

const labelMap: Record<DeviceDashboardStatus, string> = {
  transferring: '传输中',
  connected_idle: '已连接',
  offline: '未连接',
};

interface StatusBadgeProps extends VariantProps<typeof dotVariants> {
  status: DeviceDashboardStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <span className={dotVariants({ status })} />
      {labelMap[status]}
    </span>
  );
}
