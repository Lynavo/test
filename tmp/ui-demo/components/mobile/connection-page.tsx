"use client"

import { useState, useRef, useCallback } from "react"

interface ConnectionPageProps {
  onConnect: () => void
}

export function ConnectionPage({ onConnect }: ConnectionPageProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(""))
  const [error, setError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return

      const newCode = [...code]
      newCode[index] = value.slice(-1)
      setCode(newCode)
      setError(false)

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }

      if (index === 5 && value) {
        const fullCode = newCode.join("")
        if (fullCode.length === 6) {
          setVerifying(true)
          setTimeout(() => {
            setVerifying(false)
            onConnect()
          }, 1200)
        }
      }
    },
    [code, onConnect]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    },
    [code]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pastedData = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6)
      if (pastedData.length > 0) {
        const newCode = Array(6).fill("")
        for (let i = 0; i < pastedData.length; i++) {
          newCode[i] = pastedData[i]
        }
        setCode(newCode)
        if (pastedData.length === 6) {
          setVerifying(true)
          setTimeout(() => {
            setVerifying(false)
            onConnect()
          }, 1200)
        } else {
          inputRefs.current[pastedData.length]?.focus()
        }
      }
    },
    [onConnect]
  )

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "100vh", height: "100%", paddingBottom: 40 }}>
      {/* Gradient background matching reference image */}
      <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #c4e4f5 0%, #d8eef8 35%, #eaf5fb 65%, #f2f8fd 100%)",
        }}
      />
        <div
          className="absolute top-0 right-0 h-[60%] w-[80%]"
          style={{
            background:
              "radial-gradient(ellipse at 80% 20%, rgba(120,195,230,0.4) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute bottom-[30%] left-0 h-[40%] w-[60%]"
          style={{
            background:
              "radial-gradient(ellipse at 20% 80%, rgba(160,210,240,0.3) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* Content positioned at bottom area */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6 pt-16">
        <p className="mb-8 text-sm text-foreground/70 tracking-wide">
          {"请输入电脑端显示的 6 位连接码"}
        </p>

        {/* Code Input — safe margins, shrinks on very small screens */}
        <div className="mb-6 flex w-full items-center justify-center gap-2" style={{ paddingLeft: 4, paddingRight: 4 }}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              autoFocus={index === 0}
              disabled={verifying}
              style={{ flexShrink: 1, minWidth: 0 }}
              className={`h-14 w-11 max-w-[52px] rounded-2xl border-2 text-center text-xl font-semibold text-foreground shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none ${
                error
                  ? "border-destructive"
                  : digit
                    ? "border-primary/40 bg-white"
                    : "border-white/60 bg-white/70"
              } ${verifying ? "opacity-60" : ""}`}
            />
          ))}
        </div>

        {/* Status */}
        {verifying && (
          <div className="flex items-center gap-2 text-sm text-primary animate-slide-up">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>{"正在验证连接码..."}</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive animate-slide-up">
            {"连接码错误，请重新输入"}
          </p>
        )}

        {/* Help text */}
        <div className="mt-10 rounded-2xl bg-white/50 px-5 py-4 backdrop-blur-sm">
          <p className="text-xs text-foreground/50 leading-relaxed text-center">
            {"请确保手机与电脑处于同一局域网下，在电脑端打开应用即可看到连接码"}
          </p>
        </div>
      </div>
    </div>
  )
}
