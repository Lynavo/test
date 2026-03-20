# SyncFlow V2 — Project Specification

> **Status:** Active — 本文档是项目唯一的 source of truth。所有 agent 和开发者以此为准。
>
> **Date:** 2026-03-21
>
> **Supersedes:** docs/ 下的 01-05 文档及 AGENTS_SYNCFLOW_GREENFIELD.md 和 syncflow_v2_technical_design.md 仅作为历史参考，不再作为开发依据。

---

## 1. Product Overview

### 1.1 产品定义

SyncFlow 是一款 **iPhone → Mac 局域网素材无感增量同步工具**，面向短视频团队的大量图片/视频素材同步场景。用户在 iPhone 上绑定一台 Mac 后，App 自动在前台和后台持续将新增媒体文件通过局域网传输到 Mac，Mac 端提供实时看板和 SMB 共享能力。

### 1.2 本期范围

- iPhone 单目标 PC 绑定
- Bonjour/mDNS 局域网设备发现
- 6 位连接码首次绑定 + 长期配对令牌
- 自定义 TCP 串行传输 (LMUP/2)
- 当前文件断点续传（按 offset）
- 全自动增量扫描
- iPhone 后台持续同步（iOS 26+ BGContinuedProcessingTask）
- 移动端按天历史汇总
- Mac Dashboard + 设备详情弹窗
- Mac 文件夹共享配置、展示、验证与引导

### 1.3 非目标

- Android 发送端
- Windows 接收端
- 多 PC 同时绑定
- 多文件并发上传
- 用户手动勾选文件
- 传输链路端到端加密
- 云端账号体系
- 素材删除同步 / 转码 / 在线播放
- 自动化修改 macOS 系统 SMB 设置作为唯一主路径

### 1.4 硬性业务规则

1. 同一台手机同一时间只允许 1 个文件处于上传中
2. 移动端队列**绝对只读**：不支持删除、调序、跳过
3. 绑定后默认全自动增量同步，不允许手动勾选文件
4. 剩余空间低于 500 MB 时，PC 端暂停接收并告警
5. 连接码第 6 位输入完成后自动触发验证，无确认按钮
6. 首次绑定成功后 App 与 PC 建立长期配对关系
7. App 退到后台或锁屏后必须尽可能持续长时间上传

---

## 2. Architecture & Stack

### 2.1 总体架构

```
┌─────────────────────────┐        ┌─────────────────────────────────┐
│        iPhone            │        │             Mac                  │
│                          │        │                                  │
│  ┌──────────────────┐   │        │  ┌───────────┐  ┌────────────┐  │
│  │  React Native UI │   │        │  │ Electron  │  │ Go Sidecar │  │
│  └────────┬─────────┘   │        │  │ (React 18)│  │            │  │
│           │ TurboModule  │        │  └─────┬─────┘  └──────┬─────┘  │
│  ┌────────▼─────────┐   │        │        │ HTTP/WS        │        │
│  │  Swift SyncEngine │   │        │        └────────┬───────┘        │
│  │  - Discovery      │   │  LAN   │                 │               │
│  │  - PhotoScanner   │───┼────────┼─── Bonjour ────►│               │
│  │  - TcpTransport   │───┼────────┼─── LMUP/TCP ──►│               │
│  │  - UploadQueue    │   │        │        ┌────────▼──────┐        │
│  │  - BackgroundExec │   │        │        │    SQLite     │        │
│  └──────────────────┘   │        │        │  + FileSystem  │        │
│                          │        │        │  + SMB Share   │        │
└─────────────────────────┘        └────────┴────────────────┴────────┘
```

### 2.2 确认的技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| Monorepo | pnpm workspace + turborepo | pnpm ^10.32, turbo ^2.8 |
| Desktop UI | Electron + React 18 + shadcn/ui (new-york, CLI v4) + Tailwind CSS v4 | Electron ^41.0, React ^18.3.1 |
| Desktop 构建 | electron-vite + electron-builder | electron-vite ^5.0, electron-builder ^26.8 |
| Desktop 状态 | zustand | ^5.0 |
| Desktop 路由 | 无 react-router，view state 切换 | — |
| Desktop 图标 | lucide-react | ^0.577 |
| Sidecar | Go | 1.26+ |
| Sidecar 存储 | SQLite | 3.40+ |
| Mobile UI | React Native (bare, iOS only) | ^0.84 |
| Mobile 原生 | Swift (TurboModule) | Swift 5.9+ |
| Mobile 最低系统 | iOS 26.0+ | — |
| 共享包 | @syncflow/contracts, @syncflow/design-tokens | — |
| TypeScript | typescript | ^5.8 (6.0 RC 不用于生产) |
| 测试 | vitest (TS), go test (Go), XCTest (Swift) | vitest ^4.1 |

### 2.3 Monorepo 结构

```
syncflow/
├── apps/
│   ├── desktop/          # Electron app (electron-vite)
│   └── mobile/           # React Native app (bare, iOS)
├── services/
│   └── sidecar-go/       # Go sidecar (独立 go.mod, 不受 turbo 管理)
├── packages/
│   ├── contracts/        # @syncflow/contracts — 共享 DTO/枚举/事件/错误码
│   └── design-tokens/    # @syncflow/design-tokens — 色板/间距/圆角/阴影/排版
├── docs/
├── tmp/                  # ui-demo 参考（只读）
├── package.json          # workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### 2.4 职责划分

#### React Native（JS 层）

只负责：页面渲染、状态展示、连接码输入、历史记录列表、绑定设备设置、接收原生事件

不负责：Bonjour、PhotoKit、哈希判断、TCP 上传、后台任务

#### Swift SyncEngine

负责：Bonjour 浏览、配对/自动认证、后台任务注册与执行、增量扫描、资源导出、自定义 TCP 协议、串行上传、断点续传、本地状态持久化

#### Electron Renderer

负责：Dashboard、设备卡片、设备详情弹窗、设置页、连接码管理、共享地址展示、系统引导

不负责：直接起 sidecar、读本地 sqlite、调文件系统、解析 TCP 协议（全部走 preload bridge → sidecar HTTP API）

#### Go Sidecar

负责：Bonjour 广播、TCP 监听与协议解析、首次绑定/长期令牌校验、文件接收与落盘、断点续传、日统计与历史台账、共享路径配置与状态检测、供 Electron 调用的本地 HTTP/WebSocket API

---

## 3. Shared Contracts (`@syncflow/contracts`)

### 3.1 协议常量

```typescript
export const PROTOCOL_VERSION = 'LMUP/2';
export const PROTOCOL_PORT = 39393;          // LMUP TCP 端口
export const SIDECAR_HTTP_PORT = 39394;      // sidecar HTTP/WS API 端口
export const BONJOUR_SERVICE_TYPE = '_syncflow._tcp';
export const CHUNK_SIZE = 8 * 1024 * 1024;   // 8 MiB
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TIMEOUT_MS = 45_000;
export const LOW_DISK_THRESHOLD_BYTES = 500 * 1024 * 1024; // 500 MB
export const BACKOFF_RETRY_MS = [5_000, 15_000, 30_000] as const; // 网络断开后重试间隔
```

### 3.2 LMUP 消息类型

```typescript
export const MessageType = {
  HELLO_REQ:      0x0001,
  HELLO_RES:      0x0002,
  PAIR_REQ:       0x0003,
  PAIR_RES:       0x0004,
  SYNC_BEGIN_REQ: 0x0005,
  SYNC_BEGIN_RES: 0x0006,
  FILE_INIT_REQ:  0x0007,
  FILE_INIT_RES:  0x0008,
  FILE_DATA:      0x0009,
  FILE_ACK:       0x000a,
  FILE_END_REQ:   0x000b,
  FILE_END_RES:   0x000c,
  SYNC_END_REQ:   0x000d,
  SYNC_END_RES:   0x000e,
  PING:           0x000f,
  PONG:           0x0010,
  ERROR:          0x0011,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];
```

### 3.3 枚举

```typescript
export type DeviceType = 'mac' | 'win';

/** 用于 Mobile BindingStateDTO.connectionState 和设备发现列表 */
export type ConnectionState =
  | 'discovering' | 'bound' | 'connecting' | 'connected' | 'offline';

export type UploadState =
  | 'idle' | 'scanning' | 'queued' | 'uploading'
  | 'paused' | 'retrying' | 'completed' | 'failed';

export type SidecarUploadStatus =
  | 'receiving' | 'paused_resumable' | 'completed'
  | 'skipped_duplicate' | 'rejected_low_disk' | 'failed';

export type DeviceDashboardStatus = 'transferring' | 'connected_idle' | 'offline';

export type ShareStatus =
  | 'unknown' | 'needs_manual_enable' | 'share_registered' | 'ready' | 'error';

export type FileInitAction = 'UPLOAD' | 'RESUME' | 'SKIP' | 'REJECT';

/** iPhone 同步引擎状态机 */
export type SyncEngineState =
  | 'idle' | 'discovering' | 'scanning' | 'preparing'
  | 'syncing_foreground' | 'syncing_background'
  | 'backoff_waiting' | 'paused_no_target'
  | 'paused_no_permission' | 'stopped';

/** iPhone upload_items 状态 */
export type MobileUploadItemStatus =
  | 'discovered' | 'preparing' | 'ready'
  | 'uploading' | 'completed' | 'failed' | 'skipped';
```

### 3.4 DTO 类型

```typescript
// ── 设备发现 ──

export interface DiscoveredDeviceDTO {
  deviceId: string;
  name: string;
  type: DeviceType;
  ip: string;
  port: number;
  protoVersion: number;
  authMode: 'code';
  shareEnabled: boolean;
  shareName?: string;
  lastSeenAt: string;
}

// ── Desktop Dashboard ──

export interface DashboardSummaryDTO {
  todayUploadCount: number;
  todayOccupiedBytes: number;
  remainingBytes: number;
  isDiskLow: boolean;
}

export interface DashboardDeviceDTO {
  deviceId: string;
  clientName: string;
  ip: string;
  status: DeviceDashboardStatus;
  todayFileCount: number;
  todayBytes: number;
  /** 预格式化的展示值如 "1.2 TB"（精确阈值判断用 DashboardSummaryDTO.remainingBytes） */
  storageLeft: string;
  storagePath: string;
  currentFile?: {
    filename: string;
    progress: number;
    fileSize: number;
  };
}

// ── Desktop Device Detail ──

export interface DeviceFileLedgerDTO {
  fileKey: string;
  originalFilename: string;
  mediaType: string;
  fileSize: number;
  createdAtRemote?: string;
  completedAt?: string;
  activeTransmissionMs: number;
  finalPath?: string;
}

// ── Desktop Settings ──

export interface SettingsDTO {
  connectionCode: string;
  receivePath: string;
  shareAddress: string;
  shareStatus: ShareStatus;
  shareName: string;
}

export interface ShareStatusDTO {
  enabled: boolean;
  smbUrl: string | null;
  status: ShareStatus;
  lastValidatedAt?: string;
  lastError?: string;
}

// ── Mobile Sync ──

export interface SyncSummaryDTO {
  currentDeviceId: string | null;
  currentDeviceName: string | null;
  currentSpeedMbps: number;
  /** 已被 sidecar ACK 确认的字节数 */
  transferredBytes: number;
  /** 等同于 SYNC_BEGIN_REQ.queueTotalBytes */
  totalBytes: number;
  progressPercent: number;
  uploadState: UploadState;
}

export interface ReadOnlyQueueItemDTO {
  fileKey: string;
  filename: string;
  fileSize: number;
  mediaType: string;
  /** RN 展示用简化状态; failed/skipped 项不出现在只读队列中 */
  status: 'uploading' | 'waiting' | 'completed';
  progress?: number;
}

// ── Mobile 绑定状态 ──

export interface BindingStateDTO {
  deviceId: string;
  deviceName: string;
  /** 用户自定义别名，默认等于 deviceName */
  deviceAlias: string;
  host: string;
  port: number;
  connectionState: ConnectionState;
  pairingId: string;
  shareEnabled: boolean;
  shareName?: string;
  lastBoundAt: string;
}

// ── 历史记录（双端共用） ──

/**
 * Desktop 端: deviceId = iPhone 的 clientId
 * Mobile 端: deviceId = Mac 的 serverId
 * 字段含义相同，方向不同。
 */
export interface HistoryLedgerCardDTO {
  dateKey: string;       // YYYY-MM-DD
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  totalFileCount: number;
  totalBytes: number;
  activeTransmissionSeconds: number;
}
```

### 3.5 事件类型

> **约定：** 事件名使用 dot-notation（`device.state.changed`）。Go sidecar 的 WebSocket 推送使用相同名称。

```typescript
export type SidecarEvent =
  | { type: 'dashboard.updated'; payload: DashboardSummaryDTO }
  | { type: 'device.state.changed'; payload: { deviceId: string; status: DeviceDashboardStatus } }
  | { type: 'upload.progress'; payload: { deviceId: string; fileKey: string; progress: number } }
  | { type: 'upload.completed'; payload: { deviceId: string; fileKey: string } }
  | { type: 'upload.failed'; payload: { deviceId: string; fileKey: string; errorCode: string } }
  | { type: 'disk.low'; payload: { remainingBytes: number } }
  | { type: 'share.status.changed'; payload: ShareStatusDTO }
  | { type: 'sync.summary.updated'; payload: SyncSummaryDTO }
  | { type: 'history.updated'; payload: { dateKey: string; deviceId: string } };
```

> **有意不包含的事件：**
> - `device_discovered` — 初始设备列表通过 `GET /dashboard/devices` 轮询获取，新设备触发 `device.state.changed`
> - `upload_started` — 由 `upload.progress` (progress=0) 隐含表示

> **有意不包含的 API：**
> - `GET /logs?cursor=...` — 延迟到需要日志面板时再加，不影响核心链路

### 3.7 SettingsDTO 与 ShareStatusDTO 的关系

- `SettingsDTO.shareAddress` 是 **缓存展示值**，来源于上次成功校验
- `ShareStatusDTO.smbUrl` 是 **校验结果值**，来源于 `POST /share/validate`
- IP 变更时，sidecar 在 health check 中自动更新 `SettingsDTO.shareAddress`
- 两者不会长期不一致；如果一致性成问题，Settings 页每次打开会调用 `getShareStatus()`

### 3.8 错误码

```typescript
export const ErrorCode = {
  PAIR_CODE_INVALID:          'PAIR_CODE_INVALID',
  PAIR_TOKEN_INVALID:         'PAIR_TOKEN_INVALID',
  PROTO_VERSION_UNSUPPORTED:  'PROTO_VERSION_UNSUPPORTED',
  FILE_ALREADY_EXISTS:        'FILE_ALREADY_EXISTS',
  LOW_DISK_PAUSED:            'LOW_DISK_PAUSED',
  RECEIVE_ROOT_MISSING:       'RECEIVE_ROOT_MISSING',
  LOCAL_NETWORK_DENIED:       'LOCAL_NETWORK_DENIED',
  PHOTO_PERMISSION_DENIED:    'PHOTO_PERMISSION_DENIED',
  TARGET_NOT_FOUND:           'TARGET_NOT_FOUND',
  SOCKET_DISCONNECTED:        'SOCKET_DISCONNECTED',
  RESUME_NOT_AVAILABLE:       'RESUME_NOT_AVAILABLE',
  SHARE_NOT_READY:            'SHARE_NOT_READY',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

---

## 4. Design Tokens (`@syncflow/design-tokens`)

### 4.1 颜色 (OKLCH)

提取自 `tmp/ui-demo/app/globals.css` `:root` 变量。

```typescript
export const colors = {
  // 基础
  background:             'oklch(0.97 0.005 230)',
  foreground:             'oklch(0.25 0.02 240)',
  card:                   'oklch(0.99 0.003 230)',
  cardForeground:         'oklch(0.25 0.02 240)',
  popover:                'oklch(0.99 0.003 230)',
  popoverForeground:      'oklch(0.25 0.02 240)',
  // 语义
  primary:                'oklch(0.60 0.16 245)',
  primaryForeground:      'oklch(0.99 0 0)',
  secondary:              'oklch(0.93 0.02 230)',
  secondaryForeground:    'oklch(0.30 0.03 240)',
  muted:                  'oklch(0.94 0.015 230)',
  mutedForeground:        'oklch(0.50 0.03 240)',
  accent:                 'oklch(0.85 0.08 230)',
  accentForeground:       'oklch(0.25 0.04 240)',
  destructive:            'oklch(0.577 0.245 27.325)',
  destructiveForeground:  'oklch(0.577 0.245 27.325)',
  // 边框/输入
  border:                 'oklch(0.90 0.02 230)',
  input:                  'oklch(0.91 0.02 230)',
  ring:                   'oklch(0.60 0.16 245)',
  // 状态
  success:                'oklch(0.65 0.17 150)',
  successForeground:      'oklch(0.99 0 0)',
  warning:                'oklch(0.75 0.15 65)',
  warningForeground:      'oklch(0.30 0.05 65)',
  // 侧边栏
  sidebar:                'oklch(0.98 0.005 230)',
  sidebarForeground:      'oklch(0.25 0.02 240)',
  sidebarPrimary:         'oklch(0.60 0.16 245)',
  sidebarPrimaryForeground: 'oklch(0.99 0 0)',
  sidebarAccent:          'oklch(0.93 0.03 230)',
  sidebarAccentForeground:'oklch(0.30 0.03 240)',
  sidebarBorder:          'oklch(0.90 0.02 230)',
  sidebarRing:            'oklch(0.60 0.16 245)',
  // 图表
  chart1:                 'oklch(0.60 0.16 245)',
  chart2:                 'oklch(0.70 0.12 200)',
  chart3:                 'oklch(0.55 0.15 260)',
  chart4:                 'oklch(0.75 0.10 215)',
  chart5:                 'oklch(0.65 0.13 235)',
} as const;
```

### 4.2 圆角

```typescript
export const radius = {
  base: '0.75rem',
  sm:   'calc(0.75rem - 4px)',  // 0.5rem
  md:   'calc(0.75rem - 2px)',  // ~0.625rem
  lg:   '0.75rem',
  xl:   'calc(0.75rem + 4px)',  // 1rem
  '2xl':'1rem',
  '3xl':'1.25rem',
  full: '9999px',
} as const;
```

### 4.3 阴影 & 玻璃态

```typescript
export const elevation = {
  card:       '0 2px 16px rgba(100,160,210,0.10)',
  cardSubtle: '0 2px 12px rgba(100,160,210,0.08), 0 1px 3px rgba(0,0,0,0.03)',
  cardActive: '0 4px 24px rgba(59,130,246,0.12), 0 1px 4px rgba(0,0,0,0.04)',
  modal:      '0 24px 80px rgba(80,150,200,0.18), 0 4px 20px rgba(0,0,0,0.06)',
  sidebar:    '2px 0 16px rgba(100,170,220,0.08)',
  dropdown:   '0 8px 24px rgba(0,0,0,0.12)',
} as const;

export const glass = {
  sidebar:   { background: 'rgba(255,255,255,0.55)', blur: '20px' },
  card:      { background: 'rgba(255,255,255,0.72)', blur: '16px' },
  cardMuted: { background: 'rgba(255,255,255,0.45)', blur: '16px' },
  modal:     { background: 'rgba(248,252,255,0.88)', blur: '24px' },
  dropdown:  { background: 'rgba(255,255,255,0.96)', blur: '16px' },
} as const;
```

### 4.4 排版

```typescript
export const fontFamily = {
  sans: "'Geist', 'Geist Fallback', system-ui, sans-serif",
  mono: "'Geist Mono', 'Geist Mono Fallback', monospace",
} as const;

export const fontSize = {
  xs: '0.75rem', sm: '0.875rem', base: '1rem',
  lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem',
} as const;

export const fontWeight = {
  normal: '400', medium: '500', semibold: '600', bold: '700',
} as const;
```

### 4.5 间距

4px 基础制，与 Tailwind 默认一致。不单独导出——直接使用 Tailwind utility class。

---

## 5. Desktop App Spec

### 5.1 页面结构

```
AppShell
├── Sidebar (固定左侧, 14rem 宽)
│   ├── Logo + "SyncFlow" 标题
│   ├── NavItem: 首页看板 (LayoutDashboard icon)
│   └── NavItem: 全局设置 (Settings icon)
└── ContentArea
    ├── [view=dashboard] Dashboard
    │   ├── DiskWarningBanner (条件渲染)
    │   ├── "所有设备" 标题
    │   ├── StatCard × 3 (今日接收媒体总数 / 今日占用总空间 / 设备剩余空间)
    │   └── DeviceGrid (responsive: 1/2/3 列)
    │       └── DeviceCard × N
    └── [view=settings] SettingsPage
        ├── ConnectionCodeSection
        ├── FilePathSection
        ├── ShareAddressSection
        └── SystemGuideSection

DeviceDetailModal (overlay, 点击 DeviceCard 触发)
├── DeviceHeader (设备名, IP, 存储路径, 打开文件夹按钮, 关闭按钮)
├── DateFilter (日期下拉, 默认今天)
├── StatsBar (文件数 + 总大小 + 耗时 三个 badge)
└── FileLedgerTable (可排序: 文件名/大小/完成时间/创建时间/传输耗时, 操作: 打开)
```

### 5.2 Dashboard 规格

#### 告警条 (DiskWarningBanner)
- 触发：`isDiskLow === true`
- 文案：`接收磁盘剩余空间 < 500MB，已暂停所有设备的接收任务`
- 可关闭（dismiss），但不持久化关闭状态

#### 统计卡 (StatCard × 3)
| 卡片 | icon | 数据源 | 渐变色 |
|------|------|--------|--------|
| 今日接收媒体总数 | FileVideo | `summary.todayUploadCount` | blue→cyan |
| 今日占用总空间 | HardDrive | `summary.todayOccupiedBytes` | purple→violet |
| 设备剩余空间 | Database | `summary.remainingBytes` | sky→blue |

#### 设备卡片 (DeviceCard)
- 设备图标 (Smartphone) + 名称 + IP
- StatusBadge: `transferring`(蓝色脉冲) / `connected_idle`(绿色圆点) / `offline`(灰色圆点)
- 传输中时显示: 当前文件名 + Progress 进度条 + 百分比
- 底部: 今日文件数 + 今日大小
- 离线时整卡降低透明度
- 排序: transferring > connected_idle > offline

#### 交互
- 点击 DeviceCard → 打开 DeviceDetailModal
- Dashboard 数据通过 sidecar SSE/WebSocket 实时推送更新

### 5.3 Device Detail Modal 规格

- 使用 shadcn Dialog
- 头部: 设备图标、名称 + IP、存储路径、`打开文件夹` 按钮、关闭按钮
- 日期筛选: Select 下拉，可用日期列表来自 sidecar API
- 统计 Badge: `{N} 个文件`、`{X} GB`、`耗时 {HH:MM:SS}` (ACTIVE_TRANSMISSION_TIME)
- 文件台账: shadcn Table，列:
  - 文件类型 icon (视频=蓝, 图片=青, 音频=紫, 其他=灰)
  - 文件名称
  - 文件大小
  - 完成时间
  - 创建时间
  - 传输耗时
  - 操作: `打开` (shell.openPath)
- 默认排序: 完成时间倒序
- **不提供**: 搜索框、删除按钮

### 5.4 Settings 页规格

#### 连接码管理
- 6 位数字，每位一个独立方框显示
- `复制` 按钮 (clipboard)
- `重新生成` 按钮 → POST /connection-code/regenerate

#### 文件地址配置
- 接收地址: 文本框 + `选择文件夹` 按钮 + `复制` + `打开文件夹`
- 选择文件夹: Electron dialog.showOpenDialog

#### 共享地址（局域网）
- 只读显示: `smb://<ip>/SyncFlow`
- Link2 icon + `复制` 按钮

#### 系统权限指引
- 卡片: "Mac 开启本地共享操作手册"
- 点击后展示步骤: 系统设置 → General > Sharing → File Sharing → Options → 勾选 SMB

### 5.5 Electron Preload API Surface

```typescript
interface ElectronAPI {
  sidecar: {
    getHealth(): Promise<{ ok: boolean; service: string }>;
    getDashboardSummary(): Promise<DashboardSummaryDTO>;
    getDashboardDevices(): Promise<DashboardDeviceDTO[]>;
    getDeviceDetail(deviceId: string): Promise<DashboardDeviceDTO>;
    getDeviceFiles(deviceId: string, date: string): Promise<DeviceFileLedgerDTO[]>;
    getDeviceDates(deviceId: string): Promise<{ dates: string[] }>;
    getSettings(): Promise<SettingsDTO>;
    updateSettings(settings: Partial<SettingsDTO>): Promise<SettingsDTO>;
    regenerateConnectionCode(): Promise<{ code: string }>;
    getShareStatus(): Promise<ShareStatusDTO>;
    validateShare(): Promise<ShareStatusDTO>;
  };
  files: {
    openFolder(path: string): Promise<void>;
    openFile(path: string): Promise<void>;
    selectFolder(): Promise<string | null>;
    copyToClipboard(text: string): Promise<void>;
  };
  events: {
    onSidecarEvent(callback: (event: SidecarEvent) => void): () => void;
  };
  platform: {
    isMac(): boolean;
  };
}
```

### 5.6 Zustand Store 接口

```typescript
// app-store
interface AppState {
  currentView: 'dashboard' | 'settings';
  selectedDevice: DashboardDeviceDTO | null;
  isModalOpen: boolean;
  setView(view: 'dashboard' | 'settings'): void;
  openDeviceDetail(device: DashboardDeviceDTO): void;
  closeDeviceDetail(): void;
}

// dashboard-store
interface DashboardState {
  summary: DashboardSummaryDTO;
  devices: DashboardDeviceDTO[];
  diskWarningDismissed: boolean;
  dismissDiskWarning(): void;
  updateSummary(summary: DashboardSummaryDTO): void;
  updateDevices(devices: DashboardDeviceDTO[]): void;
}

// settings-store
interface SettingsState {
  settings: SettingsDTO;
  copiedField: string | null;
  updateSettings(settings: SettingsDTO): void;
  setCopied(field: string | null): void;
}

// device-detail-store
interface DeviceDetailState {
  files: DeviceFileLedgerDTO[];
  selectedDate: string;
  availableDates: string[];
  sortField: 'name' | 'size' | 'completedAt' | 'createdAt' | 'duration';
  sortDirection: 'asc' | 'desc';
  setDate(date: string): void;
  setAvailableDates(dates: string[]): void;
  toggleSort(field: string): void;
  setFiles(files: DeviceFileLedgerDTO[]): void;
}
```

### 5.7 SidecarManager Spec (Electron Main Process)

Electron main 进程负责管理 Go sidecar 子进程的生命周期。

```typescript
interface SidecarManager {
  /** 启动 sidecar 子进程。开发模式执行本地 go binary，生产模式执行 app bundle 内的 binary */
  start(): Promise<void>;
  /** 优雅关闭：先 SIGTERM，5s 后 SIGKILL */
  stop(): Promise<void>;
  /** 轮询 GET /health，成功返回 true */
  healthCheck(): Promise<boolean>;
}
```

- **开发模式:** 从 `services/sidecar-go/` 执行 `go run cmd/syncflow-sidecar/main.go`
- **生产模式:** sidecar 二进制打包在 Electron app 的 `resources/` 目录
- **健康检查:** 启动后每 3s 轮询 `/health`，连续 3 次失败则自动重启
- **崩溃重启:** 最多重启 3 次，超过则在 UI 提示错误
- **日志:** sidecar stdout/stderr 转发到 Electron 日志文件
- **端口:** `SIDECAR_HTTP_PORT` (39394)

---

## 6. Go Sidecar Spec

### 6.1 HTTP API 契约

Base URL: `http://127.0.0.1:39394`

#### GET /health

```json
// Response 200
{ "ok": true, "service": "syncflow-sidecar", "version": "0.1.0" }
```

#### GET /dashboard/summary

```json
// Response 200
{
  "todayUploadCount": 42,
  "todayOccupiedBytes": 26843545600,
  "remainingBytes": 1288490188800,
  "isDiskLow": false
}
```

#### GET /dashboard/devices

```json
// Response 200
[
  {
    "deviceId": "ios-uuid",
    "clientName": "iPhone 15 Pro",
    "ip": "192.168.1.201",
    "status": "transferring",
    "todayFileCount": 12,
    "todayBytes": 26306674688,
    "storageLeft": "1.2 TB",
    "storagePath": "/Users/alice/SyncFlow/Received/iPhone_15_Pro",
    "currentFile": {
      "filename": "DJI_0421_4K_RAW.mp4",
      "progress": 67,
      "fileSize": 3435973837
    }
  }
]
```

#### GET /devices/:deviceId

同 `DashboardDeviceDTO` 结构，单个设备。

#### GET /devices/:deviceId/files?date=YYYY-MM-DD

```json
// Response 200
[
  {
    "fileKey": "sha256-...",
    "originalFilename": "DJI_0023_PRO.mp4",
    "mediaType": "video",
    "fileSize": 2576980377,
    "createdAtRemote": "2026-03-19T08:14:00Z",
    "completedAt": "2026-03-19T14:29:00Z",
    "activeTransmissionMs": 255000,
    "finalPath": "/Users/alice/SyncFlow/Received/iPhone_15_Pro/2026-03-19/DJI_0023_PRO.mp4"
  }
]
```

#### GET /devices/:deviceId/dates

```json
// Response 200
{ "dates": ["2026-03-21", "2026-03-20", "2026-03-19"] }
```

#### GET /settings

```json
// Response 200
{
  "connectionCode": "839274",
  "receivePath": "/Users/alice/SyncFlow/Received",
  "shareAddress": "smb://192.168.1.100/SyncFlow",
  "shareStatus": "ready",
  "shareName": "SyncFlow"
}
```

#### PUT /settings

```json
// Request
{ "receivePath": "/Users/alice/SyncFlow/NewPath" }
// Response 200
{ /* updated SettingsDTO */ }
```

#### POST /connection-code/regenerate

```json
// Response 200
{ "code": "471825" }
```

#### GET /share/status

```json
// Response 200
{
  "enabled": true,
  "smbUrl": "smb://192.168.1.100/SyncFlow",
  "status": "ready",
  "lastValidatedAt": "2026-03-21T10:00:00Z",
  "lastError": null
}
```

#### POST /share/validate

```json
// Response 200
{ /* ShareStatusDTO after re-validation */ }
```

### 6.2 WebSocket 事件流

连接端点: `ws://127.0.0.1:39394/events/stream`

每条消息为 JSON:

```json
{ "type": "upload.progress", "payload": { "deviceId": "ios-uuid", "fileKey": "sha256-...", "progress": 72 } }
```

事件类型见 Section 3.5 SidecarEvent。

### 6.3 SQLite Schema

数据库路径: `~/Library/Application Support/SyncFlow/sidecar.db`

```sql
-- 配置
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 已配对设备
CREATE TABLE paired_devices (
  client_id           TEXT PRIMARY KEY,
  client_name         TEXT NOT NULL,
  device_alias        TEXT,
  last_ip             TEXT,
  platform            TEXT NOT NULL,
  pairing_id          TEXT NOT NULL,
  pairing_token_hash  TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  last_seen_at        TEXT NOT NULL,
  revoked_at          TEXT
);

-- 同步会话
CREATE TABLE sessions (
  session_id      TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  state           TEXT NOT NULL,
  active_file_key TEXT,
  active_offset   INTEGER NOT NULL DEFAULT 0,
  started_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- 文件上传记录
CREATE TABLE uploads (
  file_key              TEXT PRIMARY KEY,
  session_id            TEXT,
  client_id             TEXT NOT NULL,
  original_filename     TEXT NOT NULL,
  media_type            TEXT NOT NULL,
  file_size             INTEGER NOT NULL,
  created_at_remote     TEXT,
  modified_at_remote    TEXT,
  status                TEXT NOT NULL,
  part_path             TEXT,
  final_path            TEXT,
  committed_bytes       INTEGER NOT NULL DEFAULT 0,
  sha256                TEXT,
  active_transmission_ms INTEGER NOT NULL DEFAULT 0,
  completed_at          TEXT,
  updated_at            TEXT NOT NULL
);

-- 设备每日统计
CREATE TABLE device_daily_stats (
  stat_date             TEXT NOT NULL,
  client_id             TEXT NOT NULL,
  client_name_snapshot  TEXT NOT NULL,
  client_ip_snapshot    TEXT,
  file_count            INTEGER NOT NULL DEFAULT 0,
  total_bytes           INTEGER NOT NULL DEFAULT 0,
  active_transmission_ms INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT NOT NULL,
  PRIMARY KEY (stat_date, client_id)
);

-- 共享配置
CREATE TABLE share_config (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  receive_root      TEXT NOT NULL,
  share_name        TEXT NOT NULL,
  share_url         TEXT NOT NULL,
  share_status      TEXT NOT NULL,
  last_validated_at TEXT,
  last_error        TEXT
);
```

### 6.4 Bonjour 广播

- 服务类型: `_syncflow._tcp`
- 端口: `39393`
- Instance name: `<deviceDisplayName>`
- TXT record:

| key | 示例 | 说明 |
|-----|------|------|
| `id` | `mac-7fae12c9` | 服务端唯一 ID |
| `name` | `剪辑工作站-A` | 显示名 |
| `type` | `mac` | 设备类型 |
| `proto` | `2` | 协议版本 |
| `auth` | `code` | 首次绑定方式 |
| `share` | `1` | 是否开启共享 |
| `shareName` | `SyncFlow` | SMB 共享名 |

### 6.5 文件落盘规则

- 临时路径: `~/Library/Application Support/SyncFlow/staging/<clientId>/<fileKey>.part`
- 最终路径: `<receivePath>/<deviceAlias>/<YYYY-MM-DD>/<originalFilename>`
  - `deviceAlias` 默认等于 `clientName`，可被用户通过 `renameBoundDeviceAlias` 修改
  - alias 变更后新文件用新 alias 目录，已有文件不迁移
- 冲突策略: 若 fileKey 已完成 → SKIP; 若文件名冲突但 fileKey 不同 → 追加短后缀 `_ab12cd`

### 6.6 数据目录

```
~/Library/Application Support/SyncFlow/
├── sidecar.db
├── logs/
│   └── sidecar.log
├── staging/
│   └── <clientId>/
│       └── <fileKey>.part
└── received/   (默认 receivePath)
    └── <clientName>/
        └── <YYYY-MM-DD>/
            └── <filename>
```

---

## 7. LMUP/2 Protocol Spec

### 7.1 帧格式

```c
struct FrameHeader {
  char     magic[4];     // "LMUP"
  uint16   version;      // 2
  uint16   type;         // MessageType (Section 3.2)
  uint32   length;       // body length in bytes
};
// Total header: 12 bytes, big-endian
```

- 控制帧 body: UTF-8 JSON
- FILE_DATA body: binary (见下)

### 7.2 握手流程

#### 首次绑定

```
App → Sidecar:  HELLO_REQ  { clientId, clientName, clientPlatform, appVersion }
Sidecar → App:  HELLO_RES  { serverId, serverName, authRequired: true }
App → Sidecar:  PAIR_REQ   { clientId, clientName, connectionCode }
Sidecar → App:  PAIR_RES   { ok, pairingId, pairingToken, serverInfo }
```

#### 后续自动认证

```
App → Sidecar:  HELLO_REQ  { clientId, clientName, pairingToken, previousSessionId? }
Sidecar → App:  HELLO_RES  { authRequired: false, bound: true, resume? }
```

> HELLO_REQ also carries `deviceAlias` (latest alias set by user). Sidecar updates `paired_devices.device_alias` on each HELLO.

### 7.3 同步流程

```
App → Sidecar:  SYNC_BEGIN_REQ  { sessionId, queueMode, queueTotalCount, queueTotalBytes }
Sidecar → App:  SYNC_BEGIN_RES  { ok }

-- 对每个文件:
App → Sidecar:  FILE_INIT_REQ   { sessionId, fileKey, originalFilename, mediaType, mimeType, fileSize, createdAt, modifiedAt, queueIndex, queueTotalCount }
Sidecar → App:  FILE_INIT_RES   { action: UPLOAD|RESUME|SKIP|REJECT, resumeOffset? }

-- 如果 action = UPLOAD 或 RESUME:
App → Sidecar:  FILE_DATA       { fileKeyLen, fileKey, offset, data[8MiB] }  ×N
Sidecar → App:  FILE_ACK        { fileKey, committedOffset }

App → Sidecar:  FILE_END_REQ    { fileKey, fileSize, sha256 }
Sidecar → App:  FILE_END_RES    { ok, fileKey, relativePath, storedBytes, activeTransmissionMs }

-- 全部完成:
App → Sidecar:  SYNC_END_REQ    {}
Sidecar → App:  SYNC_END_RES    { ok }
```

### 7.4 FILE_DATA 二进制格式

```c
struct FileDataBody {
  uint16 fileKeyLen;
  byte   fileKey[fileKeyLen];
  uint64 offset;
  byte   data[...];    // 剩余 = header.length - 2 - fileKeyLen - 8
};
```

### 7.5 心跳

- 15 秒无业务消息 → 发 PING
- 45 秒无消息 → 视为断开
- 断开进入恢复流程

### 7.6 断点续传

- 恢复点: `{ sessionId, fileKey, ackedOffset }`
- 恢复时: HELLO_REQ 带 `previousSessionId` → Sidecar 返回 `resumeOffset`
- App 从 resumeOffset 继续发 FILE_DATA

### 7.7 Chunk 大小

- 固定 8 MiB (v2)
- 允许范围: 1~8 MiB

### 7.8 控制帧完整类型定义

```typescript
// HELLO_REQ body
interface HelloReq {
  clientId: string;
  clientName: string;
  clientPlatform: 'ios';
  appVersion: string;
  pairingToken?: string;
  previousSessionId?: string;
  appState: 'foreground' | 'background';
  deviceAlias?: string;
}

// HELLO_RES body
interface HelloRes {
  serverId: string;
  serverName: string;
  serverType: DeviceType;
  protoVersion: number;
  authRequired: boolean;
  bound: boolean;
  resume: {
    accepted: boolean;
    sessionId: string;
    activeFileKey?: string;
    resumeOffset: number;
  } | null;
  serverCapabilities: {
    shareEnabled: boolean;
    shareName: string;
    lowDiskPauseEnabled: boolean;
  };
  nonce: string; // for HMAC auth
}

// PAIR_REQ body
interface PairReq {
  clientId: string;
  clientName: string;
  connectionCode: string;
  deviceAlias?: string;
}

// PAIR_RES body
interface PairRes {
  ok: boolean;
  pairingId: string;
  pairingToken: string;
  serverInfo: {
    serverId: string;
    serverName: string;
    shareName: string;
  };
}

// SYNC_BEGIN_REQ body — queueMode removed (always auto_incremental)
interface SyncBeginReq {
  sessionId: string;
  queueTotalCount: number;
  queueTotalBytes: number;
}
```

### 7.9 防重放认证

后续自动认证（非首次绑定）使用 nonce-HMAC：
1. HELLO_RES 返回一次性 nonce
2. App 计算 auth = HMAC-SHA256(pairingToken, nonce)
3. App 发送第二条消息携带 auth（可复用 HELLO_REQ 或新增 AUTH_REQ）
4. Sidecar 用存储的 token hash 重新计算并比对

这不等于 TLS，但能防止局域网内最简单的凭证重放。
如果未来需要更强安全性，应升级为 TLS 传输层。

---

## 8. Mobile App Spec

### 8.1 页面结构

导航: Stack Navigator

| Screen | 入口条件 |
|--------|---------|
| DeviceDiscoveryScreen | 未绑定时的默认首页 |
| CodeVerifyScreen | 从设备列表点击设备进入 |
| SyncStatusScreen | 已绑定后的默认首页 |
| HistoryScreen | 从 SyncStatus 右上角图标进入 |
| SettingsScreen | 从 SyncStatus 右上角图标进入 |

### 8.2 搜索设备页 (DeviceDiscoveryScreen)

- Bonjour Browse 启动后自动填充列表
- 每项: 设备名 / IP / 类型 (Mac icon)
- 排序: 已绑定 > 在线（不做离线设备缓存，v2 不显示离线非绑定设备）
- 扫描动画: 脉冲环
- 重新扫描按钮
- 点击设备 → CodeVerifyScreen

### 8.3 连接码页 (CodeVerifyScreen)

- 6 个独立数字输入格
- 自动拉起数字键盘
- 第 6 位输入完成自动提交
- 验证中: spinner + "正在验证连接码..."
- 失败: 清空 6 格 + 震动 (haptic)
- 成功: 保存 pairingToken → 跳转 SyncStatusScreen

### 8.4 同步动态页 (SyncStatusScreen)

- 顶部: "同步动态" + 右上角 History / Settings 图标
- 环形进度: `sessionProgress = totalCompletedBytes / queueTotalBytes`
- 圆环内: TRANSMITTING 标签 + 百分比 + Phone/Monitor icon + 速率
- 圆环下: `已完成 X GB / Y GB`
- 完成态: 勾选图标 + "所有文件已同步" + 文件数 · 总大小
- 只读队列卡片 (仅传输中显示):
  - 标题 "排队中" + 数量 badge
  - 列表: 文件类型 icon + 文件名 + 大小
  - **无任何操作按钮**

### 8.5 历史记录页 (HistoryScreen)

- 返回按钮 + "历史记录" 标题
- 按天分组: "今天" / "昨天" / "X月X日"
- 今天: 实时 pulsing dot + "实时同步中"
- 每个设备一张卡片 (同一天同一设备**绝不重复**):
  - 设备 icon + 设备名 + IP
  - 共同步媒体文件: `{count} 个 · {size}`
  - 耗时: ACTIVE_TRANSMISSION_TIME (格式 HH:MM)
- 新文件完成时动态累加到对应卡片

### 8.6 设置页 (SettingsScreen)

- 返回按钮 + "设置" 标题
- 已连接设备卡片: 设备 icon + 名称 (可编辑) + IP + 连接状态
- `断开连接 / 切换设备` 按钮 → 清掉绑定 token → 跳回 DeviceDiscoveryScreen
- 历史记录保留

### 8.7 TurboModule 接口 (NativeSyncEngine)

```typescript
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // 权限
  requestPhotoPermission(): Promise<'granted' | 'limited' | 'denied'>;
  // 发现 (同时触发本地网络权限)
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  // 绑定
  pairDevice(params: { deviceId: string; host: string; port: number; connectionCode: string }): Promise<void>;
  disconnectAndUnbind(): Promise<void>;
  // 状态查询
  getBindingState(): Promise<BindingStateDTO | null>;
  getSyncOverview(): Promise<SyncSummaryDTO>;
  getReadOnlyQueue(): Promise<ReadOnlyQueueItemDTO[]>;
  getHistoryDays(cursor?: string): Promise<{ items: HistoryLedgerCardDTO[]; nextCursor: string | null }>;
  // 设置
  renameBoundDeviceAlias(alias: string): Promise<void>;
  // 事件 (Codegen EventEmitter)
  readonly onDiscoveredDevicesChanged: (devices: DiscoveredDeviceDTO[]) => void;
  readonly onSyncStateChanged: (summary: SyncSummaryDTO) => void;
  readonly onQueueUpdated: (queue: ReadOnlyQueueItemDTO[]) => void;
  readonly onHistoryUpdated: (card: HistoryLedgerCardDTO) => void;
  readonly onBindingStateChanged: (state: BindingStateDTO | null) => void;
  readonly onError: (error: { code: string; message: string }) => void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeSyncEngine');
```

**不向 RN 暴露:** 手动删队列、手动调整顺序、手动跳过文件

### 8.8 Native Event Emission (Swift → RN)

Swift SyncEngine 通过 TurboModule Codegen EventEmitter 向 RN 推送实时事件（见 Section 8.7 Spec 定义）。RN 侧直接订阅 NativeSyncEngine 的事件属性。

| 事件名 | payload | 消费者 |
|--------|---------|--------|
| `onDiscoveredDevicesChanged` | `DiscoveredDeviceDTO[]` | DeviceDiscoveryScreen |
| `onSyncStateChanged` | `SyncSummaryDTO` | SyncStatusScreen |
| `onQueueUpdated` | `ReadOnlyQueueItemDTO[]` | SyncStatusScreen |
| `onHistoryUpdated` | `HistoryLedgerCardDTO` | HistoryScreen |
| `onBindingStateChanged` | `BindingStateDTO \| null` | SettingsScreen |
| `onError` | `{ code: ErrorCode; message: string }` | 全局 |

### 8.9 Swift SyncEngine 模块划分

```
ios/SyncEngine/
  DiscoveryService.swift       — Bonjour Browse, 设备缓存, 已绑定设备快速重连
  BindingService.swift         — 连接码绑定, pairingToken 存取 Keychain, 绑定信息持久化
  SessionService.swift         — 同步会话管理, sessionId 生成
  BackgroundExecutionService.swift — 后台任务注册/提交, 前后台切换桥接
  PhotoScanner.swift           — 扫描图片/视频, 增量判定, 输出静态队列
  AssetExportService.swift     — 按需导出单个 PHAsset 到临时目录, 支持 iCloud 下载
  UploadQueueManager.swift     — 串行队列调度, 当前文件状态, 失败恢复
  TcpTransport.swift           — TCP 连接, LMUP 帧打包/解包, ACK 处理, 断线恢复
  UploadStore.swift            — 上传项状态表, 恢复点, 绑定配置 (SQLite)
  HistoryLedgerStore.swift     — 按天聚合历史, ACTIVE_TRANSMISSION_TIME (SQLite)
  RNBridge.swift               — TurboModule 实现, NativeEventEmitter 桥接
```

### 8.10 fileKey 计算公式

fileKey 是全局去重的唯一标识。由 iPhone 端计算，sidecar 原样存储。

```
fileKey = SHA256(
  clientId + "|" +
  assetLocalIdentifier + "|" +
  originalFilename + "|" +
  resourceSize + "|" +
  modifiedAt + "|" +
  mediaType
)
```

- `clientId`: iPhone 首次安装时生成的 UUID（存 Keychain）
- `assetLocalIdentifier`: PHAsset.localIdentifier
- `resourceSize`: 原始资源字节数
- `modifiedAt`: ISO8601 格式

### 8.11 增量扫描算法

#### 初次绑定
1. 全量扫描可见图片/视频（PHFetchOptions, creationDate desc）
2. 对每个候选项检查本地 upload_items 表是否已完成
3. 未完成项计算 fileKey，进入队列

#### 后续同步
1. 优先扫描最近更新的资产
2. 用 `assetLocalIdentifier + modifiedAt` 快速排除已完成素材
3. 对未命中的项计算 fileKey
4. 只把新增或失败未完成项加入队列

#### 导出策略
逐个导出、逐个上传、逐个删除临时文件:
1. 从 PHAsset 找到 PHAssetResource
2. 导出到 App 临时目录
3. 得到: originalFilename, size, mimeType, createdAt
4. 上传完成/跳过/失败后清理临时文件

#### iCloud 资源
- `PHAssetResourceRequestOptions.isNetworkAccessAllowed = true`
- UI 区分: `preparing`（从 iCloud 下载） vs `uploading`（传输到 PC）

#### 权限策略
- 请求 `PHAccessLevel.readWrite`
- Limited Library: 只同步可见素材，UI 提示"仅同步已授权部分素材"

### 8.12 iOS SQLite Schema

数据库路径: App Documents/syncflow.db

```sql
-- 绑定关系（单行表）
CREATE TABLE binding (
  id                          INTEGER PRIMARY KEY CHECK (id = 1),
  device_id                   TEXT NOT NULL,
  device_name                 TEXT NOT NULL,
  device_alias                TEXT,
  device_type                 TEXT NOT NULL,
  host                        TEXT NOT NULL,
  port                        INTEGER NOT NULL,
  pairing_id                  TEXT NOT NULL,
  pairing_token_keychain_ref  TEXT NOT NULL,
  share_name                  TEXT,
  last_bound_at               TEXT NOT NULL
);

-- 上传项状态
CREATE TABLE upload_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_local_id  TEXT NOT NULL,
  modified_at     TEXT NOT NULL DEFAULT '',
  media_type      TEXT NOT NULL,
  original_filename TEXT,
  file_key        TEXT,
  file_size       INTEGER,
  status          TEXT NOT NULL,  -- MobileUploadItemStatus
  temp_file_path  TEXT,
  acked_offset    INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  updated_at      TEXT NOT NULL,
  UNIQUE(asset_local_id, modified_at)  -- modified_at 为空时统一存 '' (空字符串)，保证 UNIQUE 约束可靠
);

-- 同步会话
CREATE TABLE sync_sessions (
  session_id                TEXT PRIMARY KEY,
  started_at                TEXT NOT NULL,
  ended_at                  TEXT,
  state                     TEXT NOT NULL,
  queue_total_count         INTEGER NOT NULL,
  queue_total_bytes         INTEGER NOT NULL,
  completed_count           INTEGER NOT NULL DEFAULT 0,
  completed_bytes           INTEGER NOT NULL DEFAULT 0,
  active_file_key           TEXT,
  active_offset             INTEGER NOT NULL DEFAULT 0,
  active_transmission_ms    INTEGER NOT NULL DEFAULT 0,
  updated_at                TEXT NOT NULL
);

-- 每日历史台账
CREATE TABLE daily_ledgers (
  ledger_date               TEXT NOT NULL,
  device_id                 TEXT NOT NULL,
  device_name_snapshot      TEXT NOT NULL,
  device_ip_snapshot        TEXT NOT NULL,
  file_count                INTEGER NOT NULL DEFAULT 0,
  total_bytes               INTEGER NOT NULL DEFAULT 0,
  active_transmission_ms    INTEGER NOT NULL DEFAULT 0,
  updated_at                TEXT NOT NULL,
  PRIMARY KEY (ledger_date, device_id)
);
```

---

## 9. Background Execution Spec (iOS)

### 9.1 三层后台策略

| 层 | API | 用途 |
|----|-----|------|
| 1 | `UIApplication.beginBackgroundTask` | 前后台切换桥接，给当前文件收尾 + 切换缓冲 |
| 2 | `BGContinuedProcessingTask` | 持续后台执行，承载长时间同步 |
| 3 | `BGProcessingTaskRequest` | 周期性后台维护，增量扫描 + 自动接续 |

### 9.2 状态机

```
idle → discovering → scanning → preparing → syncing_foreground
syncing_foreground → syncing_background (切后台 + continued task)
syncing_background → backoff_waiting (网络断开)
syncing_background → paused_no_target (找不到设备)
syncing_background → idle (continued task 到期, 记录恢复点)
backoff_waiting → syncing_foreground | syncing_background (重连成功)
```

### 9.3 恢复点

```typescript
interface CheckpointData {
  sessionId: string;
  fileKey: string;
  ackedOffset: number;
  tempFilePath: string;
  queueCursor: number;
  activeTransmissionAccumulatedMs: number;
}
```

### 9.4 限制

- 不承诺绝对实时触发（周期性后台是系统调度）
- 不承诺用户强制杀掉 App 后继续
- 不设计常驻通知栏（可后续补 Live Activity）

### 9.5 iOS Capabilities & Info.plist 配置清单

**必须配置项：**

| 配置项 | 值 / 说明 |
|--------|----------|
| `NSLocalNetworkUsageDescription` | "SyncFlow 需要访问本地网络以发现和连接同一局域网内的电脑" |
| `NSBonjourServices` | `["_syncflow._tcp"]` |
| `NSPhotoLibraryUsageDescription` | "SyncFlow 需要访问您的照片库以同步媒体文件到电脑" |
| `UIBackgroundModes` | `["processing"]` |
| `BGTaskSchedulerPermittedIdentifiers` | `["com.syncflow.sync.continued", "com.syncflow.sync.maintenance"]` |

**后台任务 Identifier：**

| Identifier | 类型 | 提交时机 |
|------------|------|---------|
| `com.syncflow.sync.continued` | `BGContinuedProcessingTask` | 前台同步开始时立即提交 |
| `com.syncflow.sync.maintenance` | `BGProcessingTaskRequest` | 同步会话结束或 continued task 到期时提交 |

**注册时机：**
- `BGTaskScheduler.shared.register(...)` 必须在 `application(_:didFinishLaunchingWithOptions:)` 中调用
- 两个 identifier 分别注册

---

## 10. SMB Share Spec

### 10.1 共享状态模型

`ShareStatus`:

- `unknown`: 尚未检测
- `needs_manual_enable`: File Sharing 或 SMB 未开启（smbd 进程不存在）
- `share_registered`: SMB 已开启，但 receivePath 不在系统共享列表中，或 shareName 不匹配
- `ready`: SMB 已开启，shareName 存在，且 receivePath 被正确共享
- `error`: 探测失败（如无法获取 IP、共享列表不可读等）

### 10.2 校验触发时机

- App 启动
- 设置页打开
- 接收路径变更
- 用户点击"重新校验共享"

### 10.3 共享地址格式

- 主展示: `smb://<pc-ip>/SyncFlow`
- 兼容展示: `\\<pc-ip>\SyncFlow`

### 10.4 正式版: 手动开启 + 应用验证

1. 用户在设置页选择接收路径
2. 应用展示建议共享名 `SyncFlow`
3. 用户按指引在系统设置中开启 File Sharing + SMB
4. 应用执行共享配置校验
5. 校验通过后展示 `ready`

---

## 11. Testing Strategy

### 11.1 框架选择

| 子系统 | 框架 | 环境 |
|--------|------|------|
| packages/contracts | vitest | node |
| packages/design-tokens | vitest | node |
| Desktop renderer | vitest + @testing-library/react | jsdom |
| Desktop main/preload | vitest | node |
| Go sidecar | go test | — |
| Swift SyncEngine | XCTest | iOS Simulator |
| RN components | vitest + @testing-library/react-native | — |

### 11.2 覆盖范围

#### Desktop
- **Store tests:** 每个 zustand store 的状态转换、action 行为
- **Component tests:** 关键交互（设备卡片点击、排序切换、复制按钮、告警 dismiss）
- **Integration:** Electron window 启动、preload bridge 可用

#### Go Sidecar
- **API handler tests:** 每个 HTTP 端点的 request/response 验证
- **SQLite tests:** 建表、迁移、CRUD 操作
- **Protocol tests:** LMUP 帧解析、消息序列化/反序列化
- **Bonjour tests:** 广播注册与 TXT record 验证

#### Mobile
- **Screen tests:** 每个 Screen 的渲染和基础交互
- **TurboModule tests:** JS→Native 调用 mock 验证
- **Swift engine tests:** DiscoveryService、BindingService、UploadQueueManager 单元测试

### 11.3 集成与 E2E 测试

#### Desktop ↔ Sidecar 集成 (Phase 3)
- 模拟 sidecar HTTP 响应（msw 或 local mock server）验证 preload bridge
- SidecarManager 测试: spawn → health check → kill → restart 生命周期
- WebSocket 事件推送 → zustand store 更新 → 页面重渲染

#### LMUP/2 协议集成 (Phase 4)
- Go 端: mock TCP client 发 HELLO/PAIR/SYNC/FILE 序列，验证完整接收流程
- 验证 .part → final rename、offset resume、fileKey dedup

#### 跨端冒烟测试 (Phase 5)
- Mac + iPhone Simulator: Bonjour 发现 → 连接码绑定 → 单文件上传 → Dashboard 更新
- BGContinuedProcessingTask 仅在真机测试，Simulator 测试跳过后台续传用例

### 11.4 验证命令

```bash
# 全量
pnpm turbo test
pnpm turbo typecheck
pnpm turbo lint

# 按包
pnpm turbo test --filter=@syncflow/contracts
pnpm turbo test --filter=@syncflow/desktop

# Go
cd services/sidecar-go && go test ./...

# Desktop dev 验证
cd apps/desktop && pnpm dev

# Desktop 构建验证
cd apps/desktop && pnpm build
```

---

## 12. Phasing & Milestones

### Phase 0: Monorepo Bootstrap

**交付物:** pnpm workspace + turborepo + @syncflow/contracts + @syncflow/design-tokens

**验收标准:**
- `pnpm install` + `pnpm turbo build` + `pnpm turbo test` 全部通过
- contracts 和 design-tokens 可被 apps/desktop 引用

### Phase 1: Desktop Shell

**交付物:** 可运行的 Electron 应用，所有页面使用 mock 数据

**验收标准:**
- `electron-vite dev` 启动 Electron 窗口
- Sidebar 导航切换正常
- Dashboard: 3 张统计卡 + 设备 Grid + 告警条
- Settings: 4 个配置区块完整
- DeviceDetailModal: 文件台账 + 日期筛选 + 排序
- `electron-vite build` 构建成功

### Phase 2: Go Sidecar Core

**交付物:** 独立运行的 Go sidecar，完整 HTTP API + SQLite + Bonjour

**验收标准:**
- sidecar 独立启动，`/health` 返回 ok
- 所有 HTTP 端点可用
- Bonjour 广播可被 iPhone 发现
- 连接码可生成/重置
- WebSocket 事件推送可用

**依赖:** 无（可与 Phase 1 并行）

### Phase 3: Desktop ↔ Sidecar 集成

**交付物:** Desktop 使用真实 sidecar 数据

**验收标准:**
- SidecarManager 可拉起/健康检查/崩溃重启 Go 进程
- Dashboard 显示真实设备和统计
- Settings 真实读写配置
- WebSocket 实时更新 Dashboard

**依赖:** Phase 1 + Phase 2

### Phase 4: LMUP/2 TCP 协议 + 文件接收

**交付物:** sidecar 可通过 LMUP/2 接收文件

**验收标准:**
- TCP 监听 39393 端口
- HELLO/PAIR 握手成功
- 单文件串行上传完整流程
- .part 临时文件 + finalize rename
- offset 断点续传
- PING/PONG 心跳

**依赖:** Phase 2

### Phase 5: Mobile App

**交付物:** RN + Swift 可跑通基本绑定 + 同步链路

**验收标准:**
- RN app 在 iOS Simulator 启动
- 5 个 Screen 导航正常
- Bonjour 发现 Mac sidecar
- 连接码绑定成功
- 首次全量扫描 + 串行上传
- 历史记录按天聚合
- 后台续传（BGContinuedProcessingTask）

**依赖:** Phase 3 + Phase 4

### Phase 依赖图

```
Phase 0 ──► Phase 1 ──┐
                       ├──► Phase 3 ──► Phase 5
Phase 0 ──► Phase 2 ──┤
                       └──► Phase 4 ──┘
```

Phase 1 和 Phase 2 可以**并行**开发。

---

## Appendix: ACTIVE_TRANSMISSION_TIME 计算规范

### 定义

ACTIVE_TRANSMISSION_TIME = 某个设备在某一天内，所有文件处于"正在传输"状态的时间总和。

### 不计入

- 扫描照片库
- 从 iCloud 下载原文件
- 文件导出到临时目录
- 等待发现目标设备
- 网络断开后的 backoff 等待
- idle 时间

### 计时

- 开始: 第一帧 FILE_DATA 成功写到 socket 时
- 结束: 收到 FILE_END_RES(ok=true) 或上传失败时

### 累加

- 同一天同一目标设备只维护 1 份聚合卡片
- 新完成文件的 activeTransmissionMs 累加进当天卡片
- 移动端历史页与 PC 详情页都使用此累计值
