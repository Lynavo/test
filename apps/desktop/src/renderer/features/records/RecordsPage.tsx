import { useEffect, useState } from 'react';
import { Smartphone, Search, FileText, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useManagementStore } from '@renderer/stores/management-store';
import { formatDateTime } from '@renderer/lib/format';
import { Skeleton } from '@renderer/components/ui/skeleton';

export function RecordsPage() {
  const { t } = useTranslation();
  const accessRecords = useManagementStore((state) => state.accessRecords);
  const devices = useManagementStore((state) => state.devices);
  const loading = useManagementStore((state) => state.accessRecordsLoading);
  const error = useManagementStore((state) => state.accessRecordsError);
  const loadAccessRecords = useManagementStore((state) => state.loadAccessRecords);
  const loadDevices = useManagementStore((state) => state.loadDevices);

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(4);

  useEffect(() => {
    void loadAccessRecords();
    void loadDevices();
  }, [loadAccessRecords, loadDevices]);

  // Group access logs by device + date (YYYY-MM-DD)
  const groupedSessions = accessRecords.reduce((acc, record) => {
    const dateKey = record.accessedAt ? record.accessedAt.split('T')[0] : '2026-06-11';
    const key = `${record.clientId}:${dateKey}`;

    const matchedDevice = devices.find(
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
  }, {} as Record<string, { key: string; clientId: string; displayName: string; platform: string; accessedAt: string; date: string; ip: string; files: string[] }>);

  const sessions = Object.values(groupedSessions).sort((a, b) =>
    b.accessedAt.localeCompare(a.accessedAt),
  );

  const getMockLocation = (ip: string) => {
    if (ip === '192.168.1.112') return '广东省深圳市 · 移动';
    if (ip === '128.85.130.25') return '广东省广州市 · 联通';
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

  const visibleSessions = filteredSessions.slice(0, limit);

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 text-xl font-bold text-[#1a2a3a]">访问记录</h1>

        {/* Filter bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索用户名、设备或 IP"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none shadow-sm focus:border-slate-400 transition"
            />
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/60 bg-white/50 p-1 shadow-sm">
            <input
              type="text"
              placeholder="yyyy/mm/dd"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-24 bg-transparent text-center text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="text"
              placeholder="yyyy/mm/dd"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-24 bg-transparent text-center text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        {/* Access Log Sessions */}
        <div className="flex flex-col gap-4">
          {loading && sessions.length === 0 && (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && filteredSessions.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/45 px-6 py-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
              <FileText className="h-8 w-8 text-slate-400" />
              <h2 className="mt-3 text-sm font-bold text-slate-800">尚无访问记录</h2>
              <p className="mt-1 text-xs text-slate-400">
                符合筛选条件的设备资源访问历史将在这里显示。
              </p>
            </div>
          )}

          {!error &&
            visibleSessions.map((session) => (
              <div
                key={session.key}
                className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)]"
              >
                {/* Header of card */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                  {/* Left: Device Icon & Labels */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f4ff] text-[#1890ff] shadow-sm">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        {session.displayName || '未命名设备'}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#858b96]">
                        {session.platform || 'iPhone'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Date, IP & ISP */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#858b96] sm:text-right sm:flex-col sm:items-end">
                    <span className="font-semibold">{session.date}</span>
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{getMockLocation(session.ip)}</span>
                      <span>📶 {session.ip}</span>
                    </div>
                  </div>
                </div>

                {/* Accessed Files Area */}
                <div className="rounded-xl bg-white/50 border border-slate-100 p-4">
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <span>📥 {session.files.length} 个文件</span>
                  </div>

                  <ul className="flex flex-col gap-2 pl-1.5">
                    {session.files.map((file, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-[#525964]">
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{file}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

          {/* More button */}
          {filteredSessions.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((prev) => prev + 4)}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/60 bg-white/45 py-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-white/80 active:scale-[0.985] text-center cursor-pointer"
            >
              <span>更多</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
