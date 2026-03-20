"use client"

import { useState } from "react"
import { LayoutDashboard, Settings } from "lucide-react"
import { Dashboard } from "./dashboard"
import { SettingsPage } from "./settings-page"
import { DeviceDetailModal } from "./device-detail-modal"
import type { Device } from "@/lib/mock-data"

type PCView = "dashboard" | "settings"

export function PCApp() {
  const [view, setView] = useState<PCView>("dashboard")
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device)
    setModalOpen(true)
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #daeef8 0%, #e8f5fb 40%, #f0f8fd 70%, #f8fbff 100%)",
      }}
    >
      {/* Sidebar */}
      <aside
        className="flex w-56 flex-col z-10"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "2px 0 16px rgba(100,170,220,0.08)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #60c4f0 100%)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white" opacity="0.3"/>
              <path d="M17 12l-5-5-5 5h3v4h4v-4h3z" fill="white"/>
            </svg>
          </div>
          <span className="text-base font-bold" style={{ color: "#1a2a3a" }}>SyncFlow</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-2">
          <button
            onClick={() => setView("dashboard")}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              view === "dashboard"
                ? "text-primary"
                : "text-[#6b7a8d] hover:text-[#1a2a3a]"
            }`}
            style={
              view === "dashboard"
                ? {
                    background: "rgba(255,255,255,0.85)",
                    boxShadow: "0 2px 12px rgba(59,130,246,0.10)",
                  }
                : {}
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            {"\u9996\u9875\u770B\u677F"}
          </button>
          <button
            onClick={() => setView("settings")}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              view === "settings"
                ? "text-primary"
                : "text-[#6b7a8d] hover:text-[#1a2a3a]"
            }`}
            style={
              view === "settings"
                ? {
                    background: "rgba(255,255,255,0.85)",
                    boxShadow: "0 2px 12px rgba(59,130,246,0.10)",
                  }
                : {}
            }
          >
            <Settings className="h-4 w-4" />
            {"\u5168\u5C40\u8BBE\u7F6E"}
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {view === "dashboard" ? (
          <Dashboard onSelectDevice={handleSelectDevice} />
        ) : (
          <SettingsPage />
        )}
      </div>

      <DeviceDetailModal
        device={selectedDevice}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedDevice(null)
        }}
      />
    </div>
  )
}
