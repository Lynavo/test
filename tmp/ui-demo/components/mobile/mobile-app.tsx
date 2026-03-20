"use client"

import { useState } from "react"
import { ConnectionPage } from "./connection-page"
import { TransferPage } from "./transfer-page"
import { HistoryPage } from "./history-page"
import { SettingsPage } from "./settings-page"

type MobileView = "connection" | "transfer" | "history" | "settings"

export function MobileApp() {
  const [view, setView] = useState<MobileView>("connection")

  if (view === "connection") {
    return <ConnectionPage onConnect={() => setView("transfer")} />
  }

  if (view === "history") {
    return <HistoryPage onBack={() => setView("transfer")} />
  }

  if (view === "settings") {
    return (
      <SettingsPage
        deviceName={"\u526a\u8f91\u5de5\u4f5c\u7ad9-A \u00b7 192.168.1.101"}
        onBack={() => setView("transfer")}
        onDisconnect={() => setView("connection")}
      />
    )
  }

  return (
    <TransferPage
      onNavigateHistory={() => setView("history")}
      onNavigateSettings={() => setView("settings")}
    />
  )
}
