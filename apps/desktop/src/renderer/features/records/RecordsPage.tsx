import { useEffect, useState } from 'react';
import { Smartphone, Search, FileText, ChevronDown, Download, Globe, Wifi } from 'lucide-react';
import { useManagementStore } from '@renderer/stores/management-store';
import { Skeleton } from '@renderer/components/ui/skeleton';
import {
  previewAccessRecords,
  previewManagedDevices,
  shouldUsePreviewData,
} from '@renderer/features/preview/demo-data';

const RECORDS_PER_PAGE = 5;

export function RecordsPage() {
  const accessRecords = useManagementStore((state) => state.accessRecords);
  const devices = useManagementStore((state) => state.devices);
  const loading = useManagementStore((state) => state.accessRecordsLoading);
  const error = useManagementStore((state) => state.accessRecordsError);
  const loadAccessRecords = useManagementStore((state) => state.loadAccessRecords);
  const loadDevices = useManagementStore((state) => state.loadDevices);

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadAccessRecords();
    void loadDevices();
  }, [loadAccessRecords, loadDevices]);

  const usingPreviewRecords = !loading && !error && shouldUsePreviewData(accessRecords.length > 0);
  const visibleAccessRecords = usingPreviewRecords ? previewAccessRecords : accessRecords;
  const visibleDevices =
    usingPreviewRecords && devices.length === 0 ? previewManagedDevices : devices;

  // Group access logs by device + date (YYYY-MM-DD)
  const groupedSessions = visibleAccessRecords.reduce(
    (acc, record) => {
      const dateKey = record.accessedAt ? record.accessedAt.split('T')[0] : '2026-06-11';
      const key = `${record.clientId}:${dateKey}`;

      const matchedDevice = visibleDevices.find(
        (d) => d.clientId === record.clientId || d.stableDeviceId === record.clientId,
      );
      const ip = matchedDevice?.lastIp || '192.168.1.106';
      const platform = matchedDevice?.platform || 'iPhone';

      if (!acc[key]) {
        acc[key] = {
          key,
          clientId: record.clientId,
          displayName: record.displayName,
          platform,
          accessedAt: record.accessedAt,
          date: dateKey,
          ip,
          files: [] as string[],
        };
      }

      if (record.resourceName && !acc[key].files.includes(record.resourceName)) {
        acc[key].files.push(record.resourceName);
      }
      return acc;
    },
    {} as Record<
      string,
      {
        key: string;
        clientId: string;
        displayName: string;
        platform: string;
        accessedAt: string;
        date: string;
        ip: string;
        files: string[];
      }
    >,
  );

  const sessions = Object.values(groupedSessions).sort((a, b) =>
    b.accessedAt.localeCompare(a.accessedAt),
  );

  const getMockLocation = (ip: string) => {
    if (ip === '192.168.1.112') return '广东省深圳市 · 移动';
    if (ip === '120.85.130.25') return '广东省广州市 · 联通';
    return '广东省深圳市 · 电信';
  };

  const filteredSessions = sessions.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = s.displayName.toLowerCase().includes(q);
      const ipMatch = s.ip.includes(q);
      const fileMatch = s.files.some((f) => f.toLowerCase().includes(q));
      if (!nameMatch && !ipMatch && !fileMatch) return false;
    }
    if (startDate) {
      const formattedStart = startDate.replace(/\//g, '-');
      if (s.date < formattedStart) return false;
    }
    if (endDate) {
      const formattedEnd = endDate.replace(/\//g, '-');
      if (s.date > formattedEnd) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / RECORDS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const visibleSessions = filteredSessions.slice(
    (safePage - 1) * RECORDS_PER_PAGE,
    safePage * RECORDS_PER_PAGE,
  );
  const dateInputClass =
    'h-[46px] w-[150px] shrink-0 rounded-lg border border-white/70 bg-white/54 px-3 text-sm font-medium text-[#17191c] outline-none shadow-[0_10px_30px_rgba(90,120,170,0.08)] transition [font-variant-numeric:tabular-nums] focus:border-[#66c6ff] focus:bg-white/70 focus:ring-2 focus:ring-[#66c6ff]/18';

  useEffect(() => {
    setPage(1);
  }, [searchQuery, startDate, endDate]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1460px] px-8 py-6">
        <header className="mb-5 flex min-h-12 items-center justify-between gap-5 border-b border-white/60 pb-5">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-tight text-[#17191c]">
              访问记录
            </h1>
          </div>
        </header>

        {/* Filter bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8490]" />
            <input
              type="text"
              placeholder="搜索用户名、设备或 IP"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/70 bg-white/54 py-3 pl-10 pr-3 text-sm outline-none shadow-[0_10px_30px_rgba(90,120,170,0.08)] transition placeholder:text-[#9aa3af] focus:border-[#66c6ff] focus:bg-white/70 focus:ring-2 focus:ring-[#66c6ff]/18"
            />
          </div>

          {/* Date range inputs */}
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="date"
              aria-label="开始日期"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className={dateInputClass}
            />
            <span className="text-sm text-[#7b8490]">-</span>
            <input
              type="date"
              aria-label="结束日期"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={dateInputClass}
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="h-[46px] shrink-0 rounded-lg border border-white/70 bg-white/54 px-3 text-sm font-semibold text-[#59616d] transition hover:bg-white/78 hover:text-[#17191c]"
              >
                清空
              </button>
            )}
          </div>
        </div>

        {/* Access Log Sessions */}
        <div className="flex flex-col gap-4">
          {loading && sessions.length === 0 && (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && filteredSessions.length === 0 && (
            <div className="rounded-lg border border-white/70 bg-white/46 px-5 py-10 text-center shadow-[0_18px_54px_rgba(70,96,138,0.1)] backdrop-blur-xl">
              <p className="text-sm font-semibold text-[#17191c]">没有匹配的访问记录</p>
              <p className="mt-1 text-xs text-[#7b8490]">尝试更换关键词或日期</p>
            </div>
          )}

          {!error &&
            visibleSessions.map((session) => (
              <div
                key={session.key}
                className="rounded-lg border border-white/70 bg-white/46 p-5 shadow-[0_18px_54px_rgba(70,96,138,0.1)] backdrop-blur-xl"
              >
                {/* Header of card */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* Left: Device Icon & Labels */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eaf6ff] text-[#1677d2] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#17191c]">
                        {session.displayName || '未命名设备'}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-[#626a76]">
                        {session.platform || 'iPhone'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Date, IP & ISP */}
                  <div className="ml-auto flex shrink-0 items-center gap-4 text-xs font-medium text-[#4f5b68]">
                    <span className="w-[78px] whitespace-nowrap text-right [font-variant-numeric:tabular-nums]">
                      {session.date}
                    </span>
                    <span className="w-[120px] truncate whitespace-nowrap text-right">
                      {getMockLocation(session.ip)}
                    </span>
                    <div className="inline-flex w-[128px] items-center justify-end gap-1.5 whitespace-nowrap font-mono [font-variant-numeric:tabular-nums]">
                      {session.ip.startsWith('192.') ? (
                        <Wifi className="h-3.5 w-3.5 shrink-0 text-[#7b8794]" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 shrink-0 text-[#7b8794]" />
                      )}
                      <span>{session.ip}</span>
                    </div>
                  </div>
                </div>

                {/* Accessed Files Area */}
                <div className="mt-4 rounded-md border border-white/70 bg-white/52">
                  <div className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-[#4f5b68]">
                    <Download className="h-3.5 w-3.5 shrink-0 text-[#7b8794]" />
                    <span>{session.files.length} 个文件</span>
                  </div>

                  <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-white/70 px-4 py-3 sm:grid-cols-2">
                    {session.files.map((file, idx) => (
                      <li
                        key={idx}
                        className="flex min-w-0 items-center gap-2 text-[13px] text-[#17191c]"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[#9aa2ad]" />
                        <span className="truncate">{file}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-1" aria-label="访问记录分页">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-white/70 bg-white/52 px-3 text-xs font-semibold text-[#4f5b68] transition hover:bg-white/80 hover:text-[#17191c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                上一页
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={safePage === pageNumber ? 'page' : undefined}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${
                    safePage === pageNumber
                      ? 'bg-[#1677d2] text-white shadow-[0_10px_22px_rgba(22,119,210,0.28)]'
                      : 'border border-white/70 bg-white/52 text-[#4f5b68] hover:bg-white/80 hover:text-[#17191c]'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage === totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-white/70 bg-white/52 px-3 text-xs font-semibold text-[#4f5b68] transition hover:bg-white/80 hover:text-[#17191c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
                <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
