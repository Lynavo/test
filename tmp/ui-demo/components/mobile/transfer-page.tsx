"use client"

import { useState, useEffect } from "react"
import { History, Settings, Smartphone, Monitor, FileVideo, FileImage, File } from "lucide-react"

interface TransferFile {
  id: string
  name: string
  size: string
  totalSize?: string
  status: "transferring" | "waiting" | "completed"
}

interface TransferPageProps {
  onNavigateHistory: () => void
  onNavigateSettings: () => void
}

const mockTransferQueue: TransferFile[] = [
  { id: "1", name: "DJI_0022_PRO.mp4", size: "845 MB", totalSize: "1.2 GB", status: "transferring" },
  { id: "2", name: "DJI_0023_PRO.mp4", size: "2.4 GB", status: "waiting" },
  { id: "3", name: "IMG_8492.HEIC", size: "12 MB", status: "waiting" },
  { id: "4", name: "A001_C012_1024.braw", size: "4.2 GB", status: "waiting" },
  { id: "5", name: "IMG_8493.HEIC", size: "14 MB", status: "waiting" },
  { id: "6", name: "DJI_0024_PRO.mp4", size: "1.8 GB", status: "waiting" },
  { id: "7", name: "DJI_0025_PRO.mp4", size: "2.1 GB", status: "waiting" },
]

// Total sizes for completion state
const TOTAL_FILES = mockTransferQueue.length
const TOTAL_SIZE = "12.4 GB"

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase()
  if (["mp4", "mov", "braw", "avi", "mxf"].includes(ext ?? ""))
    return <FileVideo className="h-5 w-5 text-[#3b9fd8]" />
  if (["heic", "jpg", "jpeg", "png", "raw"].includes(ext ?? ""))
    return <FileImage className="h-5 w-5 text-[#5ba8d8]" />
  return <File className="h-5 w-5 text-[#3b9fd8]" />
}

const PARTICLES = [
  { top: "12%", left: "8%", size: 3, opacity: 0.7 },
  { top: "18%", left: "88%", size: 2, opacity: 0.5 },
  { top: "28%", left: "5%", size: 2, opacity: 0.4 },
  { top: "30%", left: "92%", size: 3, opacity: 0.6 },
  { top: "50%", left: "3%", size: 2, opacity: 0.5 },
  { top: "55%", left: "95%", size: 2, opacity: 0.4 },
  { top: "68%", left: "7%", size: 3, opacity: 0.6 },
  { top: "72%", left: "90%", size: 2, opacity: 0.5 },
  { top: "82%", left: "12%", size: 2, opacity: 0.4 },
  { top: "85%", left: "85%", size: 3, opacity: 0.7 },
]

export function TransferPage({ onNavigateHistory, onNavigateSettings }: TransferPageProps) {
  const [progress, setProgress] = useState(68)
  const [mounted, setMounted] = useState(false)
  const [done, setDone] = useState(false)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || done) return
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => { setDone(true); setTimeout(() => setShowDone(true), 50) }, 400)
          return 100
        }
        return prev + 0.8
      })
    }, 200)
    return () => clearInterval(interval)
  }, [mounted, done])

  const waitingFiles = mockTransferQueue.filter((f) => f.status === "waiting")

  const circleSize = 220
  const strokeWidth = 9
  const radius = (circleSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progressOffset = circumference - (progress / 100) * circumference

  return (
    <div
      className="relative flex flex-col"
      style={{ minHeight: "100vh", background: "linear-gradient(180deg, #d6ecf8 0%, #c5e2f5 22%, #e6f2fb 52%, #f4f9fd 100%)" }}
    >
      {showDone && PARTICLES.map((p, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full bg-[#3b9fd8]"
          style={{ top: p.top, left: p.left, width: p.size, height: p.size, opacity: p.opacity }}
        />
      ))}

      {/* Header */}
      <header className="sticky top-0 z-20">
        <div className="flex items-center justify-between px-5 pt-12 pb-3">
          <h1 className="text-lg font-bold text-[#1a3a5c]">{"\u540c\u6b65\u52a8\u6001"}</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={onNavigateHistory}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#1a3a5c]/50 transition-colors hover:bg-white/50"
              aria-label={"\u5386\u53f2\u8bb0\u5f55"}
            >
              <History className="h-5 w-5" />
            </button>
            <button
              onClick={onNavigateSettings}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#1a3a5c]/50 transition-colors hover:bg-white/50"
              aria-label={"\u8bbe\u7f6e"}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Progress / Done card */}
        <section className="flex flex-col items-center px-5 pt-4 pb-6">
          <div
            className="w-full rounded-3xl px-6 py-8 flex flex-col items-center"
            style={{
              background: "rgba(255,255,255,0.62)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              boxShadow: "0 4px 32px rgba(80,160,210,0.10)",
            }}
          >
            {/* TRANSMITTING state */}
            <div
              className="flex flex-col items-center w-full"
              style={{
                opacity: done ? 0 : 1,
                transition: "opacity 0.5s ease",
                position: done ? "absolute" : "relative",
                pointerEvents: done ? "none" : "auto",
              }}
            >
              <div className="relative flex items-center justify-center" style={{ width: circleSize, height: circleSize }}>
                <svg className="absolute inset-0" width={circleSize} height={circleSize} style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#85ccf0" />
                      <stop offset="50%" stopColor="#3b9fd8" />
                      <stop offset="100%" stopColor="#1e7ab8" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <circle cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none" stroke="#daeef8" strokeWidth={strokeWidth} />
                  <circle
                    cx={circleSize / 2} cy={circleSize / 2} r={radius}
                    fill="none" stroke="url(#pg)" strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={progressOffset}
                    transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
                    className="transition-all duration-200 ease-out"
                    filter="url(#glow)"
                  />
                </svg>
                <div className="relative flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold tracking-widest text-[#7eb8d8] uppercase">TRANSMITTING</span>
                  <div className="flex items-center gap-3 mt-1">
                    <Smartphone className="h-5 w-5 text-[#3b9fd8]" />
                    <span className="text-[42px] font-bold leading-none text-[#3b9fd8]">{Math.round(progress)}%</span>
                    <Monitor className="h-5 w-5 text-[#3b9fd8]" />
                  </div>
                  <span className="mt-1.5 text-sm font-semibold text-[#3b9fd8]">45 MB/s</span>
                </div>
              </div>
              <div className="mt-5 text-center">
                <p className="text-sm text-[#8ab0c8]">
                  {"\u5df2\u5b8c\u6210 "}{Math.round((progress / 100) * parseFloat(TOTAL_SIZE))}{" GB / "}{TOTAL_SIZE}
                </p>
              </div>
            </div>

            {/* DONE state */}
            <div
              className="flex flex-col items-center w-full"
              style={{
                opacity: showDone ? 1 : 0,
                transition: "opacity 0.7s ease",
                position: done ? "relative" : "absolute",
                pointerEvents: done ? "auto" : "none",
                minHeight: 220,
                justifyContent: "center",
              }}
            >
              <div className="relative flex items-center justify-center mb-4">
                <div
                  className="absolute rounded-full"
                  style={{ width: 120, height: 120, background: "radial-gradient(circle, rgba(59,159,216,0.18) 0%, rgba(59,159,216,0) 70%)" }}
                />
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" stroke="#c5e5f5" strokeWidth="4" fill="rgba(59,159,216,0.08)" />
                  <polyline points="22,42 35,56 58,26" stroke="#3b9fd8" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <p className="text-[22px] font-bold text-[#3b9fd8] tracking-tight">{"\u6240\u6709\u6587\u4ef6\u5df2\u540c\u6b65"}</p>
              {/* Total files + total size — no filename */}
              <div className="mt-4 flex flex-col items-center gap-1">
                <p className="text-base font-bold text-[#3b9fd8]">
                  {TOTAL_FILES}{" \u4e2a\u6587\u4ef6 · "}{TOTAL_SIZE}
                </p>
                <p className="text-xs text-[#9bb8c8]">{"\u672c\u6b21\u540c\u6b65\u5df2\u5168\u90e8\u5b8c\u6210"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Queue Card — read-only, no swipe-delete, no clear button */}
        {!done && waitingFiles.length > 0 && (
          <section className="flex-1 px-5 pb-6">
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.80)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "0 2px 20px rgba(80,160,210,0.08)",
              }}
            >
              {/* Header — count badge only, no clear button */}
              <div
                className="flex items-center gap-2 px-5 py-4"
                style={{ borderBottom: "1px solid #eef3f8" }}
              >
                <span className="text-[15px] font-bold text-[#1a3a5c]">{"\u6392\u961f\u4e2d"}</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3b9fd8] px-1.5 text-xs font-bold text-white">
                  {waitingFiles.length}
                </span>
              </div>

              {/* List — pure display, no swipe or action */}
              <div>
                {waitingFiles.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-5 py-3.5 bg-white"
                    style={{ borderBottom: index !== waitingFiles.length - 1 ? "1px solid #f2f6fa" : "none" }}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef6fc]">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1e3a54] truncate">{file.name}</p>
                      <p className="text-xs text-[#a8bece] mt-0.5">{file.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
