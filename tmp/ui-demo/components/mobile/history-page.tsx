"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Monitor } from "lucide-react"
import { mockHistoryDays } from "@/lib/mock-data"

interface HistoryPageProps {
  onBack: () => void
}

// Simulated background files completing every few seconds
// Two devices interleaved — same device ALWAYS merges into ONE card
const LIVE_FILES = [
  { sizeGB: 1.5,   device: { name: "\u526a\u8f91\u5de5\u4f5c\u7ad9-A", ip: "192.168.1.101" } },
  { sizeGB: 0.012, device: { name: "MacBook Pro",              ip: "192.168.1.108" } },
  { sizeGB: 4.2,   device: { name: "\u526a\u8f91\u5de5\u4f5c\u7ad9-A", ip: "192.168.1.101" } },
  { sizeGB: 1.8,   device: { name: "\u526a\u8f91\u5de5\u4f5c\u7ad9-A", ip: "192.168.1.101" } },
  { sizeGB: 2.4,   device: { name: "MacBook Pro",              ip: "192.168.1.108" } },
  { sizeGB: 0.014, device: { name: "\u526a\u8f91\u5de5\u4f5c\u7ad9-A", ip: "192.168.1.101" } },
  { sizeGB: 3.6,   device: { name: "\u526a\u8f91\u5de5\u4f5c\u7ad9-A", ip: "192.168.1.101" } },
  { sizeGB: 0.89,  device: { name: "MacBook Pro",              ip: "192.168.1.108" } },
]

interface LiveCard {
  deviceName: string
  deviceIp: string
  fileCount: number
  totalSizeGB: number
  lastSyncTime: string
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatSizeGB(gb: number): string {
  if (gb < 0.001) return `${Math.round(gb * 1024 * 1024)} KB`
  if (gb < 1)     return `${(gb * 1024).toFixed(0)} MB`
  return `${gb.toFixed(1)} GB`
}

function dateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const target    = new Date(y, m - 1, d)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (target.toDateString() === today.toDateString())     return "\u4eca\u5929"
  if (target.toDateString() === yesterday.toDateString()) return "\u6628\u5929"
  return `${m}\u6708${d}\u65e5`
}

export function HistoryPage({ onBack }: HistoryPageProps) {
  // liveCards: keyed by deviceIp — one card per device, ever
  const [liveCards, setLiveCards] = useState<Map<string, LiveCard>>(new Map())
  const [mounted, setMounted]     = useState(false)
  const [tick, setTick]           = useState(0)

  useEffect(() => { setMounted(true) }, [])

  // Complete one file every 3.5 s
  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => setTick((p) => p + 1), 3500)
    return () => clearInterval(t)
  }, [mounted])

  // On each tick: pick next file, UPSERT into the correct device card
  useEffect(() => {
    if (!mounted || tick === 0) return
    const file = LIVE_FILES[(tick - 1) % LIVE_FILES.length]
    const now  = nowHHMM()

    setLiveCards((prev) => {
      const next = new Map(prev)
      const existing = next.get(file.device.ip)
      if (existing) {
        next.set(file.device.ip, {
          ...existing,
          fileCount:    existing.fileCount + 1,
          totalSizeGB:  existing.totalSizeGB + file.sizeGB,
          lastSyncTime: now,
        })
      } else {
        next.set(file.device.ip, {
          deviceName:   file.device.name,
          deviceIp:     file.device.ip,
          fileCount:    1,
          totalSizeGB:  file.sizeGB,
          lastSyncTime: now,
        })
      }
      return next
    })
  }, [tick, mounted])

  const todayStr  = new Date().toISOString().split("T")[0]
  const pastDays  = mockHistoryDays
    .filter((d) => d.date !== todayStr && d.sessions.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  const todayList = Array.from(liveCards.values())

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #daeef8 0%, #c8e5f5 20%, #eaf4fb 55%, #f5f9fd 100%)",
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ background: "transparent" }}>
        <div className="flex items-center gap-3 px-4 pb-3 pt-12">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm"
            aria-label={"\u8fd4\u56de"}
          >
            <ArrowLeft className="h-4 w-4 text-[#1a2a4a]" />
          </button>
          <h1 className="text-lg font-bold text-[#1a2a4a]">{"\u5386\u53f2\u8bb0\u5f55"}</h1>
        </div>
      </header>

      <main className="flex-1 px-4 pb-10">

        {/* ── TODAY (live ledger) ── */}
        {todayList.length > 0 && (
          <section className="mb-6">
            {/* Section label */}
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <span className="text-sm font-semibold text-[#4a6a8a]">{"\u4eca\u5929"}</span>
              {/* Pulsing live dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ background: "#3b9fd8" }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#2a90d0" }} />
              </span>
              <span className="text-xs font-medium text-[#90b8d0]">{"\u5b9e\u65f6\u540c\u6b65\u4e2d"}</span>
            </div>

            {/* One card per device — never duplicates */}
            <div className="flex flex-col gap-3">
              {todayList.map((card) => (
                <LiveDeviceCard
                  key={card.deviceIp}
                  deviceName={card.deviceName}
                  deviceIp={card.deviceIp}
                  fileCount={card.fileCount}
                  totalSize={formatSizeGB(card.totalSizeGB)}
                  lastSyncTime={card.lastSyncTime}
                  isActive
                />
              ))}
            </div>
          </section>
        )}

        {/* ── PAST DAYS (static) ── */}
        {pastDays.map((day) => (
          <section key={day.date} className="mb-6">
            <div className="mb-2.5 px-1">
              <span className="text-sm font-semibold text-[#4a6a8a]">{dateLabel(day.date)}</span>
            </div>
            <div className="flex flex-col gap-3">
              {day.sessions.map((session) => (
                <LiveDeviceCard
                  key={session.id}
                  deviceName={session.deviceName}
                  deviceIp={session.deviceIp}
                  fileCount={session.fileCount}
                  totalSize={session.totalSize}
                  lastSyncTime={session.lastSyncTime}
                  isActive={false}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Empty state — only if nothing at all */}
        {todayList.length === 0 && pastDays.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-24">
            <p className="text-sm text-[#8aabbd]">{"\u6682\u65e0\u540c\u6b65\u8bb0\u5f55"}</p>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Device summary card ──────────────────────────────────────────────────────
interface LiveDeviceCardProps {
  deviceName: string
  deviceIp: string
  fileCount: number
  totalSize: string
  lastSyncTime: string
  isActive: boolean
}

function LiveDeviceCard({
  deviceName,
  deviceIp,
  fileCount,
  totalSize,
  lastSyncTime,
  isActive,
}: LiveDeviceCardProps) {
  return (
    <div
      className="rounded-2xl px-4 pt-4 pb-4"
      style={{
        background:    "rgba(255,255,255,0.88)",
        backdropFilter:"blur(16px)",
        boxShadow:     "0 2px 14px rgba(80,150,200,0.09)",
      }}
    >
      {/* Row 1: device icon + name + IP */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #5cc8f0 0%, #2a90d0 100%)" }}
        >
          <Monitor className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-[#1a2a4a] truncate">
            {deviceName}
          </p>
          <p className="text-xs leading-snug text-[#9ab8cc]">{deviceIp}</p>
        </div>
        {isActive && (
          <span className="shrink-0 rounded-full bg-[#e8f6fd] px-2 py-0.5 text-[10px] font-semibold text-[#2a90d0]">
            {"\u5b9e\u65f6"}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mb-3" style={{ height: 1, background: "rgba(160,200,225,0.22)" }} />

      {/* Row 2: file count + size (left)  |  last sync (right) */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="mb-0.5 text-[11px] text-[#9ab8cc]">{"\u5171\u540c\u6b65\u5a92\u4f53\u6587\u4ef6"}</p>
          <p className="text-[15px] font-bold leading-tight tabular-nums text-[#1a2a4a]">
            <span className="text-[#2a90d0]">{fileCount}</span>
            <span className="mx-1 text-[#c8dce8]">{"\u4e2a"}</span>
            <span className="text-[#c8dce8]">&middot;</span>
            <span className="ml-1">{totalSize}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-[#b8d0dc]">{"\u8017\u65f6"}</p>
          <p className="text-xs font-semibold tabular-nums text-[#2a90d0]">{lastSyncTime}</p>
        </div>
      </div>
    </div>
  )
}
