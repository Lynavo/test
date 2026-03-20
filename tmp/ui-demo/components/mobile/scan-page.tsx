"use client"

import { useState, useEffect } from "react"
import { Wifi, Monitor, ChevronRight, RefreshCw } from "lucide-react"

interface LanDevice {
  id: string
  name: string
  ip: string
  model: string
}

const mockLanDevices: LanDevice[] = [
  { id: "pc1", name: "\u526a\u8f91\u5de5\u4f5c\u7ad9-A", ip: "192.168.1.101", model: "Windows PC" },
  { id: "pc2", name: "MacBook Pro", ip: "192.168.1.108", model: "macOS" },
  { id: "pc3", name: "\u5907\u7528\u673a-B", ip: "192.168.1.115", model: "Windows PC" },
]

interface ScanPageProps {
  onSelectDevice: (device: LanDevice) => void
}

export function ScanPage({ onSelectDevice }: ScanPageProps) {
  const [scanning, setScanning] = useState(true)
  const [devices, setDevices] = useState<LanDevice[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDevices(mockLanDevices)
      setScanning(false)
    }, 1800)
    return () => clearTimeout(timer)
  }, [])

  const handleRescan = () => {
    setScanning(true)
    setDevices([])
    setTimeout(() => {
      setDevices(mockLanDevices)
      setScanning(false)
    }, 1800)
  }

  return (
    <div
      className="relative flex flex-col"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #c4e4f5 0%, #d8eef8 35%, #eaf5fb 65%, #f2f8fd 100%)",
      }}
    >
      {/* Background radial glows */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-0 right-0 h-[50%] w-[70%]"
          style={{ background: "radial-gradient(ellipse at 80% 10%, rgba(120,195,230,0.35) 0%, transparent 60%)" }}
        />
        <div
          className="absolute bottom-[20%] left-0 h-[40%] w-[60%]"
          style={{ background: "radial-gradient(ellipse at 10% 80%, rgba(160,215,240,0.25) 0%, transparent 60%)" }}
        />
      </div>

      <div className="relative z-10 flex flex-col pt-16 px-5">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(59,159,216,0.12)" }}>
            <Wifi className="h-7 w-7" style={{ color: "#3b9fd8" }} />
          </div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a3a5c" }}>
            {"\u641c\u7d22\u8bbe\u5907"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#6a96b8" }}>
            {"\u6b63\u5728\u626b\u63cf\u5c40\u57df\u7f51\u4e2d\u7684\u7535\u8111\u7aef\u5e94\u7528..."}
          </p>
        </div>

        {/* Scanning animation */}
        {scanning && (
          <div className="flex flex-col items-center py-10 gap-5">
            <div className="relative flex items-center justify-center">
              {/* Pulse rings */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border-2"
                  style={{
                    width: 60 + i * 36,
                    height: 60 + i * 36,
                    borderColor: `rgba(59,159,216,${0.35 - i * 0.1})`,
                    animation: `ping 1.8s ease-out ${i * 0.4}s infinite`,
                  }}
                />
              ))}
              <div
                className="relative flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "rgba(59,159,216,0.15)", border: "2px solid rgba(59,159,216,0.4)" }}
              >
                <Wifi className="h-6 w-6" style={{ color: "#3b9fd8" }} />
              </div>
            </div>
            <p className="text-sm" style={{ color: "#6a96b8" }}>{"\u626b\u63cf\u4e2d\uff0c\u8bf7\u7a0d\u5019..."}</p>
          </div>
        )}

        {/* Device list */}
        {!scanning && (
          <div className="flex flex-col gap-2">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-sm" style={{ color: "#8aabbd" }}>{"\u672a\u53d1\u73b0\u8bbe\u5907"}</p>
              </div>
            ) : (
              <>
                <p className="mb-1 text-xs font-medium px-1" style={{ color: "#6a96b8" }}>
                  {"\u53d1\u73b0 "}{devices.length}{" \u53f0\u8bbe\u5907"}
                </p>
                {devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => onSelectDevice(device)}
                    className="flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.98]"
                    style={{
                      background: "rgba(255,255,255,0.75)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(255,255,255,0.9)",
                      boxShadow: "0 2px 16px rgba(80,160,210,0.08)",
                    }}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "linear-gradient(135deg, #4db8ea 0%, #2e8fcc 100%)", boxShadow: "0 3px 10px rgba(59,159,216,0.3)" }}
                    >
                      <Monitor className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: "#1a3a5c" }}>{device.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#8aabbd" }}>
                        {device.model} · {device.ip}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#b0c8da" }} />
                  </button>
                ))}
              </>
            )}

            {/* Rescan */}
            <button
              onClick={handleRescan}
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium transition-colors"
              style={{ background: "rgba(255,255,255,0.55)", color: "#5a9abf", border: "1px solid rgba(255,255,255,0.7)" }}
            >
              <RefreshCw className="h-4 w-4" />
              {"\u91cd\u65b0\u626b\u63cf"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ping {
          0% { transform: scale(0.85); opacity: 0.8; }
          70% { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
