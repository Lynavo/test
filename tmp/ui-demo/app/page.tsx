"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Monitor, Smartphone } from "lucide-react"

const PCApp = dynamic(
  () => import("@/components/pc/pc-app").then((mod) => ({ default: mod.PCApp })),
  { ssr: false, loading: () => <LoadingSpinner /> }
)

const MobileApp = dynamic(
  () => import("@/components/mobile/mobile-app").then((mod) => ({ default: mod.MobileApp })),
  { ssr: false, loading: () => <LoadingSpinner /> }
)

function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Side buttons left (volume) */}
      <div className="absolute left-0 top-[120px] z-20 flex flex-col gap-3">
        <div className="h-8 w-[3px] rounded-full bg-[#c8d5e0] translate-x-[1px]" />
        <div className="h-14 w-[3px] rounded-full bg-[#c8d5e0] translate-x-[1px]" />
        <div className="h-14 w-[3px] rounded-full bg-[#c8d5e0] translate-x-[1px]" />
      </div>

      {/* Side button right (power) */}
      <div className="absolute right-0 top-[160px] z-20">
        <div className="h-20 w-[3px] rounded-full bg-[#c8d5e0] -translate-x-[1px]" />
      </div>

      {/* Phone outer shell */}
      <div
        className="relative overflow-visible"
        style={{
          width: 375,
          height: 812,
          borderRadius: 54,
          background: "linear-gradient(145deg, #e8f2f8 0%, #d4e6f2 40%, #c8dded 100%)",
          boxShadow:
            "0 40px 80px rgba(60,120,180,0.22), 0 16px 40px rgba(60,120,180,0.14), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(180,210,230,0.5)",
          padding: "10px",
        }}
      >
        {/* Inner bezel */}
        <div
          className="relative h-full w-full overflow-hidden"
          style={{
            borderRadius: 46,
            background: "#f8fbfd",
            boxShadow: "inset 0 2px 8px rgba(60,120,180,0.12)",
          }}
        >
          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-7 pt-3 pb-1 pointer-events-none">
            <span className="text-[13px] font-semibold text-[#1a3a5c]">9:41</span>
            <div className="flex items-center gap-1.5">
              {/* Signal bars */}
              <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                <rect x="0" y="6" width="3" height="6" rx="0.5" fill="#1a3a5c" />
                <rect x="4.5" y="4" width="3" height="8" rx="0.5" fill="#1a3a5c" />
                <rect x="9" y="2" width="3" height="10" rx="0.5" fill="#1a3a5c" />
                <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="#1a3a5c" opacity="0.3" />
              </svg>
              {/* WiFi */}
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M8 10.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="#1a3a5c" />
                <path d="M5.2 8.2a4 4 0 0 1 5.6 0" stroke="#1a3a5c" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                <path d="M2.8 6a7 7 0 0 1 10.4 0" stroke="#1a3a5c" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5" />
              </svg>
              {/* Battery */}
              <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
                <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#1a3a5c" strokeOpacity="0.35" />
                <rect x="2" y="2" width="16" height="8" rx="2" fill="#1a3a5c" />
                <path d="M23 4v4a2 2 0 0 0 0-4z" fill="#1a3a5c" fillOpacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Dynamic island / notch */}
          <div
            className="absolute top-3 left-1/2 z-40 -translate-x-1/2"
            style={{
              width: 126,
              height: 37,
              borderRadius: 20,
              background: "#0a1520",
              boxShadow: "0 2px 8px rgba(10,21,32,0.4)",
            }}
          />

          {/* Scrollable content */}
          <div className="h-full w-full overflow-y-auto overflow-x-hidden" style={{ borderRadius: 46 }}>
            <MobileApp />
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 pointer-events-none">
            <div
              className="rounded-full"
              style={{ width: 134, height: 5, background: "rgba(26,58,92,0.2)" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [mode, setMode] = useState<"mobile" | "pc">("pc")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <LoadingSpinner />

  return (
    <div className="relative h-screen overflow-hidden bg-[#eaf3f9]" suppressHydrationWarning>
      {/* Mode switcher */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full border border-[#c8dded] bg-white/90 p-1 shadow-lg backdrop-blur-xl">
        <button
          onClick={() => setMode("pc")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "pc"
              ? "bg-[#3b9fd8] text-white shadow-sm"
              : "text-[#5a7a9a] hover:text-[#1a3a5c]"
          }`}
        >
          <Monitor className="h-3.5 w-3.5" />
          PC
        </button>
        <button
          onClick={() => setMode("mobile")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "mobile"
              ? "bg-[#3b9fd8] text-white shadow-sm"
              : "text-[#5a7a9a] hover:text-[#1a3a5c]"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Mobile
        </button>
      </div>

      {mode === "pc" ? (
        <PCApp />
      ) : (
        <div
          className="flex h-screen items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at 30% 40%, rgba(120,195,230,0.25) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(180,220,240,0.2) 0%, transparent 50%), linear-gradient(135deg, #daeef8 0%, #eaf5fb 50%, #d8ecf7 100%)",
          }}
        >
          <div
            className="overflow-auto"
            style={{ maxHeight: "100vh", paddingTop: 24, paddingBottom: 24 }}
          >
            <PhoneMockup>
              <MobileApp />
            </PhoneMockup>
          </div>
        </div>
      )}
    </div>
  )
}
