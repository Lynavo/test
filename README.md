# Vivi Drop

移动端（iOS / Android）→ Desktop（macOS / Windows）局域网素材无感增量同步工具，面向短视频团队。

## 当前状态

- 桌面端、Go sidecar、移动端和 iOS / Android 原生同步能力都已落地
- iOS 与 Android 移动端都属于当前支持范围
- 当前工作重点是 beta 收口、异常恢复、后台上传和发布验证
- 仓库中目前没有单独维护的产品 spec 文件；开发基线以当前代码、`@syncflow/contracts` 和测试矩阵为准

## 前置依赖

- **macOS 或 Windows**（桌面端当前支持 macOS / Windows；iOS 构建仍需 macOS + Xcode）
- **Node.js** >= 22.11.0
- **pnpm** >= 10
- **Go** >= 1.25.6（sidecar 开发和测试）
- **Xcode + CocoaPods**（iOS 构建和真機偵錯，僅 macOS）
- **Android Studio + Android SDK / NDK**（Android 构建和调试）

## 快速開始

```bash
# 1. 安裝依賴
pnpm install

# 2. 建置共享包
pnpm --filter @syncflow/contracts build
pnpm --filter @syncflow/design-tokens build

# 3. 啟動 Desktop 開發模式
pnpm dev:desktop
```

Electron 窗口會自動打開；桌面端會負責拉起 sidecar。

## 常用命令

```bash
# Desktop
pnpm dev:desktop
pnpm build:desktop
pnpm package:desktop:signed   # macOS signed DMG
pnpm package:desktop:win      # Windows NSIS + zip（預設 desktop Windows 包，不帶 release profile）

# Mobile
pnpm dev:mobile
pnpm build:mobile
pnpm dev:mobile:android
pnpm build:mobile:android

# Sidecar
pnpm dev:sidecar
pnpm build:sidecar
pnpm test:sidecar

# 全倉驗證
pnpm build
pnpm test
pnpm typecheck
pnpm format:check
pnpm check
```

## 發佈與 Review 打包

正式發佈、Review 包、TestFlight 上傳、Android APK、Desktop DMG / EXE 都應先選 release profile，避免手動拼接 market 或 API base URL：

```bash
# 檢查實際 market、Review 狀態、base URL 與會執行的命令
pnpm release --profile global-review --targets win --dry-run

# 打 global-review Windows EXE / zip
pnpm release --profile global-review --targets win

# 打 cn-review Windows EXE / zip
pnpm release --profile cn-review --targets win

# 打 global-prod Windows EXE / zip
pnpm release --profile global-prod --targets win

# 打 cn-prod Windows EXE / zip
pnpm release --profile cn-prod --targets win

# 打完整 Review 版本（iOS TestFlight + macOS DMG + Windows EXE / zip）
pnpm release --profile global-review --targets ios,mac,win
pnpm release --profile cn-review --targets ios,mac,win

# 打完整 global-prod / cn-prod 版本
pnpm release --profile global-prod --targets ios,mac,win
pnpm release --profile cn-prod --targets ios,mac,win
```

`package:desktop:win` / `@syncflow/desktop package:win:global` 只負責 Windows 封裝與 market 設定；`*-review` / `*-prod` 都應走 `release` 指令，讓 profile 統一注入正確的 `SYNCFLOW_RELEASE_PROFILE`、market 與 API base URL。`global-review` / `cn-review` 指向 `https://review-api.vividrop.cn`，`global-prod` 指向 `https://global-api.vividrop.cn`，`cn-prod` 指向 `https://api.vividrop.cn`。

## 專案結構

```text
vivi-drop/
├── apps/
│   ├── desktop/              # Electron 桌面應用
│   │   └── src/
│   │       ├── main/         # 主進程（窗口、IPC、sidecar 生命周期）
│   │       ├── preload/      # 預先加載橋接
│   │       └── renderer/     # React 18 UI
│   └── mobile/               # React Native iOS/Android 應用 + 平台原生同步能力
│       ├── ios/              # Xcode 工程、Swift 原生模組
│       ├── android/          # Android 工程、Kotlin bridge、原生同步能力
│       ├── src/              # RN 頁面和 hooks
│       └── __tests__/        # RN 測試
├── packages/
│   ├── contracts/            # 共享 DTO / 常量 / 事件 / 錯誤碼
│   └── design-tokens/        # 共享設計 token
├── services/
│   └── sidecar-go/           # Go sidecar（TCP/HTTP/SQLite/mDNS）
├── docs/
│   ├── architecture/         # 架構、狀態機、數據模型
│   ├── operations/           # 排障、診斷、環境、sidecar 運行手冊
│   ├── product/              # 產品約束與非目標
│   ├── release/              # TestFlight / 簽名 / 發版手冊
│   └── testing/              # 測試矩陣和 beta 驗證說明
└── tmp/
    └── ui-demo/              # 視覺參考，僅供比對，不直接複用程式碼
```

## 技術棧

| 層             | 技術                                                       |
| -------------- | ---------------------------------------------------------- |
| Monorepo       | pnpm 10 + turborepo 2.8                                    |
| Desktop        | Electron 41 + electron-vite 5 + electron-builder 26        |
| Desktop UI     | React 18.3 + zustand 5 + Tailwind CSS v4                   |
| Mobile         | React Native 0.84.1 + React 19（iOS / Android）            |
| iOS Native     | Swift `SyncEngine` + BGTask + PhotoKit + Network.framework |
| Android Native | Kotlin bridge + NativeSyncEngine / MediaStore / NsdManager |
| Sidecar        | Go 1.25.6 + SQLite + WebSocket                             |
| Shared         | `@syncflow/contracts` + `@syncflow/design-tokens`          |
| Test           | vitest 4.1 + jest + `go test`                              |

## 架構概覽

```text
Mobile (RN UI on iOS / Android)
  ├── iOS: Swift SyncEngine
  └── Android: Kotlin NativeSyncEngine
  ├── Bonjour/mDNS discover
  ├── LMUP/TCP :39393
  └── Presence/HTTP :39394
                │
                ▼
Desktop (Electron + Go sidecar, macOS / Windows)
  ├── Electron: UI 殼、窗口、橋接、sidecar 生命周期管理
  ├── Sidecar HTTP API / WebSocket
  ├── LMUP 檔案接收
  ├── SQLite
  └── 檔案系統 / 共享目錄偵測
```

## 開發基線

- 共享型別、常量、事件名、連接埠定義統一來自 `@syncflow/contracts`
- renderer 不直接存取 sidecar、檔案系統、SQLite；全部透過 preload bridge / main 進程轉發
- 佇列保持唯讀，不允許在 UI 裡刪除、重排或跳過
- 同一台手機同一時間只允許序列上傳一個檔案
- `tmp/ui-demo/` 只做視覺參考，不作為實作來源

## 檔案

- 開發約束與執行準則：[`AGENTS.md`](./AGENTS.md)
- 系統概覽：[`docs/architecture/system-overview.md`](./docs/architecture/system-overview.md)
- 同步狀態機：[`docs/architecture/sync-state-machine.md`](./docs/architecture/sync-state-machine.md)
- 資料模型與統計口徑：[`docs/architecture/data-model.md`](./docs/architecture/data-model.md)
- 排障手冊：[`docs/operations/troubleshooting.md`](./docs/operations/troubleshooting.md)
- Mobile 診斷包說明：[`docs/operations/mobile-diagnostics.md`](./docs/operations/mobile-diagnostics.md)
- Sidecar 運作手冊：[`docs/operations/sidecar-runbook.md`](./docs/operations/sidecar-runbook.md)
- 環境與秘密金鑰說明：[`docs/operations/environment-and-secrets.md`](./docs/operations/environment-and-secrets.md)
- 產品約束與非目標：[`docs/product/constraints.md`](./docs/product/constraints.md)
- Beta 發佈手冊：[`docs/release/release-playbook.md`](./docs/release/release-playbook.md)
- beta 測試矩陣：[`docs/testing/beta-test-matrix.md`](./docs/testing/beta-test-matrix.md)

## License

Private — 內部使用
