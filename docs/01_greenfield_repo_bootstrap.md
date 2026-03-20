# 01. Greenfield 仓库搭建方案

## 1. 目标

从零搭建一套可以同时承载：
- Electron Desktop
- Go sidecar
- React Native iOS App
- 共享 contracts / design tokens

的工程骨架。

## 2. 推荐方式

### 2.1 JS/TS 层
- 使用 `pnpm workspace`
- 统一 TypeScript 版本
- 统一 ESLint / Prettier / commit hooks

### 2.2 Go 层
- 单独 `go.mod`
- Sidecar 独立构建与测试
- 由 Electron 主进程负责拉起 sidecar 进程

### 2.3 根目录建议

```text
syncflow/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json                 # 可选
├── tsconfig.base.json
├── .editorconfig
├── .gitignore
├── apps/
│   ├── desktop/
│   └── mobile/
├── services/
│   └── sidecar-go/
├── packages/
│   ├── contracts/
│   └── design-tokens/
├── docs/
└── scripts/
```

## 3. apps/desktop

### 3.1 推荐结构

```text
apps/desktop/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml       # 或其它打包配置
├── src/
│   ├── app/
│   ├── pages/
│   ├── components/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── device-detail/
│   │   ├── settings/
│   │   └── common/
│   ├── services/
│   │   ├── sidecar-client/
│   │   ├── dto-mappers/
│   │   └── queries/
│   ├── store/
│   └── types/
├── electron-main/
│   ├── main.ts
│   ├── sidecar-manager.ts
│   ├── file-open.ts
│   └── app-events.ts
└── preload/
    └── index.ts
```

### 3.2 Desktop 的边界

Renderer 不直接：
- 起 sidecar
- 读本地 sqlite
- 调文件系统
- 解析 TCP 协议

这些都走：
- `electron-main`
- `preload`
- `sidecar HTTP / SSE API`

## 4. apps/mobile

### 4.1 推荐结构

```text
apps/mobile/
├── package.json
├── tsconfig.json
├── app.json                   # 若使用 bare + 最小配置可保留
├── babel.config.js
├── metro.config.js
├── src/
│   ├── navigation/
│   ├── screens/
│   │   ├── DeviceDiscoveryScreen/
│   │   ├── CodeVerifyScreen/
│   │   ├── SyncStatusScreen/
│   │   ├── HistoryScreen/
│   │   └── SettingsScreen/
│   ├── components/
│   ├── features/
│   │   ├── discovery/
│   │   ├── binding/
│   │   ├── sync-status/
│   │   ├── history/
│   │   └── settings/
│   ├── native/
│   │   ├── sync-engine/
│   │   └── mappers/
│   ├── store/
│   └── theme/
├── specs/
│   └── NativeSyncEngine.ts
└── ios/
```

### 4.2 Mobile 的边界

JS 层不直接做：
- Bonjour 浏览
- PhotoKit 读取
- 哈希判断
- TCP 上传
- 后台任务

这些全部下沉到 Swift SyncEngine。

## 5. services/sidecar-go

### 5.1 推荐结构

```text
services/sidecar-go/
├── go.mod
├── cmd/
│   └── syncflow-sidecar/
│       └── main.go
├── internal/
│   ├── api/
│   ├── auth/
│   ├── bonjour/
│   ├── config/
│   ├── db/
│   ├── disk/
│   ├── events/
│   ├── ledger/
│   ├── protocol/
│   ├── sessions/
│   ├── share/
│   ├── stats/
│   └── transport/
├── migrations/
└── test/
```

### 5.2 Sidecar 对外职责

对 Desktop 暴露：
- `/health`
- `/devices`
- `/dashboard/summary`
- `/devices/:id/detail`
- `/settings`
- `/settings/share`
- `/events/stream`

对 Mobile 暴露：
- Bonjour 广播
- 自定义 TCP 监听
- 配对握手
- 上传会话

## 6. packages/contracts

只放共享领域契约：
- DTO
- 状态枚举
- 事件名
- 错误码
- 协议版本号

不要放：
- React 组件
- RN 组件
- Node 代码
- Go 代码

## 7. packages/design-tokens

可以共享：
- 颜色
- 圆角
- 阴影层级名称
- 间距语义 token
- 文本层级 token
- 图标语义 key

不要共享：
- CSS class
- Tailwind utility
- styled-components 定义
- RN StyleSheet 对象

## 8. 初始里程碑

### M0 仓库初始化
- 建 workspace
- 建 lint/test 基础
- 建 packages/contracts
- 建 design-tokens

### M1 Desktop 壳
- Electron 能启动
- preload 能工作
- sidecar manager 能拉起 Go 二进制

### M2 Mobile 壳
- bare RN app 跑通 iOS
- navigation 跑通
- TurboModule spec 跑通 codegen

### M3 Sidecar 壳
- health API
- config API
- SQLite 初始化
- Bonjour 广播

## 9. 不要做的事

- 不要把旧 v0 项目当 app 宿主改造
- 不要一开始就做复杂动画
- 不要先追求完整视觉还原
- 不要把协议字段散落在 TS / Go / Swift 三端
