"use client"

import { useState } from "react"
import { ArrowLeft, Monitor, LogOut, Pencil, Check } from "lucide-react"

interface SettingsPageProps {
  deviceName: string
  onBack: () => void
  onDisconnect: () => void
}

export function SettingsPage({ deviceName, onBack, onDisconnect }: SettingsPageProps) {
  const defaultName = deviceName || "\u526a\u8f91\u5de5\u4f5c\u7ad9-A · 192.168.1.101"
  const [editing, setEditing] = useState(false)
  const [customName, setCustomName] = useState(defaultName.split(" · ")[0])
  const ipPart = defaultName.includes(" · ") ? defaultName.split(" · ")[1] : "192.168.1.101"

  return (
    <div className="relative flex flex-col overflow-hidden" style={{ minHeight: "100vh" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, #daeef8 0%, #c8e5f5 20%, #eaf4fb 55%, #f5f9fd 100%)" }}
      />

      <div className="relative z-10 flex flex-col" style={{ minHeight: "100vh" }}>
        <header className="flex items-center gap-3 px-4 pb-3 pt-12">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm transition-colors hover:bg-white/80"
            aria-label={"\u8fd4\u56de"}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: "#1a3a5c" }} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "#1a3a5c" }}>{"\u8bbe\u7f6e"}</h1>
        </header>

        <main className="flex-1 px-4 pt-2">
          {/* Connected Device Card */}
          <div className="mb-4 rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #4db8ea 0%, #2e8fcc 100%)", boxShadow: "0 3px 10px rgba(59,159,216,0.3)" }}
              >
                <Monitor className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="flex-1 rounded-lg border border-[#b8d8ea] bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-[#3b9fd8]"
                      style={{ color: "#1a3a5c" }}
                      autoFocus
                    />
                    <button
                      onClick={() => setEditing(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{ background: "rgba(59,159,216,0.12)", color: "#3b9fd8" }}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold truncate" style={{ color: "#1a3a5c" }}>
                      {customName}
                    </p>
                    <button
                      onClick={() => setEditing(true)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                      style={{ color: "#a0bcd0" }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-xs mt-0.5" style={{ color: "#90b0c8" }}>{ipPart}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                  <span className="text-xs" style={{ color: "#22c55e" }}>{"\u5df2\u8fde\u63a5"}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onDisconnect}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors"
              style={{ background: "rgba(59,159,216,0.08)", color: "#3b9fd8", border: "1px solid rgba(59,159,216,0.18)" }}
            >
              <LogOut className="h-4 w-4" />
              <span>{"\u65ad\u5f00\u8fde\u63a5 / \u5207\u6362\u8bbe\u5907"}</span>
            </button>
          </div>

          {/* Device name hint */}
          <p className="px-1 text-xs" style={{ color: "#90b0c8" }}>
            {"\u8bbe\u5907\u540d\u79f0\u9ed8\u8ba4\u683c\u5f0f\uff1a\u8bbe\u5907\u540d + IP \u5730\u5740\uff0c\u53ef\u70b9\u51fb\u7f16\u8f91\u56fe\u6807\u81ea\u5b9a\u4e49\u540d\u79f0"}
          </p>
        </main>
      </div>
    </div>
  )
}
