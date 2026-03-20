"use client"

import { useState } from "react"
import {
  Copy,
  RefreshCw,
  FolderOpen,
  Link2,
  BookOpen,
  Check,
} from "lucide-react"
import { connectionCode } from "@/lib/mock-data"

export function SettingsPage() {
  const [code, setCode] = useState(connectionCode)
  const [receivePath, setReceivePath] = useState("D:\\MediaSync\\Received")
  const [copied, setCopied] = useState<string | null>(null)

  const shareLink = `\\\\192.168.1.100\\MediaSync\\Received`

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegenerate = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString()
    setCode(newCode.slice(0, 3) + " " + newCode.slice(3))
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-8 text-xl font-semibold text-foreground">
          {"\u8BBE\u7F6E"}
        </h1>

        {/* Connection Code */}
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            {"\u8FDE\u63A5\u7801\u7BA1\u7406"}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {"\u6240\u6709\u8BBE\u5907\u901A\u8FC7\u6B64\u8FDE\u63A5\u7801\u4E0E\u7535\u8111\u914D\u5BF9"}
          </p>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex items-center gap-1">
                {code
                  .replace(" ", "")
                  .split("")
                  .map((digit, i) => (
                    <div
                      key={i}
                      className="flex h-14 w-11 items-center justify-center rounded-xl bg-secondary text-xl font-bold text-foreground"
                    >
                      {digit}
                    </div>
                  ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleCopy(code.replace(" ", ""), "code")}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                {copied === "code" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === "code"
                  ? "\u5DF2\u590D\u5236"
                  : "\u590D\u5236"}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                {"\u91CD\u65B0\u751F\u6210"}
              </button>
            </div>
          </div>
        </section>

        {/* File Path Config */}
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            {"\u6587\u4EF6\u5730\u5740\u914D\u7F6E"}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {"\u914D\u7F6E\u6587\u4EF6\u63A5\u6536\u8DEF\u5F84\u548C\u5171\u4EAB\u8BBE\u7F6E"}
          </p>

          <div className="mb-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {"\u63A5\u6536\u5730\u5740"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={receivePath}
                onChange={(e) => setReceivePath(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleCopy(receivePath, "receive")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {copied === "receive" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {"\u5171\u4EAB\u5730\u5740\uFF08\u5C40\u57DF\u7F51\uFF09"}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                <Link2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{shareLink}</span>
              </div>
              <button
                onClick={() => handleCopy(shareLink, "share")}
                className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                {copied === "share" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === "share"
                  ? "\u5DF2\u590D\u5236"
                  : "\u590D\u5236"}
              </button>
            </div>
          </div>
        </section>

        {/* System Guide */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            {"\u7CFB\u7EDF\u6743\u9650\u6307\u5F15"}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {"\u5C40\u57DF\u7F51\u5171\u4EAB\u9700\u8981\u5F00\u542F\u7CFB\u7EDF\u6587\u4EF6\u5171\u4EAB\u6743\u9650"}
          </p>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3">
              <button className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left transition-colors hover:bg-secondary/80">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {"Windows \u5F00\u542F\u672C\u5730\u5171\u4EAB\u64CD\u4F5C\u624B\u518C"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {"\u9002\u7528\u4E8E Windows 10/11 \u7CFB\u7EDF"}
                  </p>
                </div>
              </button>
              <button className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-left transition-colors hover:bg-secondary/80">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {"Mac \u5F00\u542F\u672C\u5730\u5171\u4EAB\u64CD\u4F5C\u624B\u518C"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {"\u9002\u7528\u4E8E macOS Ventura \u53CA\u4EE5\u4E0A"}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
