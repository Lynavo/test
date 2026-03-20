# AGENTS_SYNCFLOW_GREENFIELD

## 1. 项目定位

你正在实现一个全新的 SyncFlow V2 工程。

禁止假设：
- 现有 v0 PC 项目可以直接继续开发。
- 现有 v0 Mobile 项目可以直接继续开发。
- 现有 React Web 页面可以原样复用到 React Native。

允许做法：
- 把 v0 PC / Mobile 项目当成**视觉稿 + 交互参考**。
- 人工提取页面结构、色板、间距、文案、状态切换。
- 在新工程中重新实现页面与状态管理。

## 2. 本期硬约束

- PC：macOS only
- Desktop：Electron + React + TypeScript
- Sidecar：Go
- Mobile：React Native（iPhone only）+ Swift 原生传输层
- 发现：Bonjour / mDNS
- 认证：6 位连接码
- 传输：自定义 TCP
- 队列：单通道串行，1 台手机同一时刻只传 1 个文件
- 同步：全自动增量同步，不允许手动勾选文件
- 队列：只读，不允许前端剔除 / 调序 / 清空
- PC 文件夹共享：支持展示 SMB 路径与共享状态，并给出系统级引导

## 3. 关于 UI 参考项目的规则

### 3.1 Desktop
可以参考：
- 页面布局
- 玻璃态卡片层级
- Grid 卡片密度
- 弹窗结构
- 字段文案
- 图标语义

不要直接复用：
- 原有路由结构
- 原有 mock store
- 原有 API 协议
- 原有状态机
- 原有 fake data

### 3.2 Mobile
可以参考：
- 搜索设备页布局
- 连接码页视觉
- 同步动态页环形进度样式
- 历史记录页卡片分组
- 设置页分组与设备头部信息

不要直接复用：
- DOM 组件
- CSS / Tailwind / styled-components Web 样式
- 任何依赖浏览器行为的交互
- 任何桌面 hover 逻辑

## 4. Greenfield 仓库目标结构

```text
syncflow/
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   ├── electron-main/
│   │   ├── preload/
│   │   └── package.json
│   └── mobile/
│       ├── src/
│       ├── ios/
│       ├── specs/
│       └── package.json
├── services/
│   └── sidecar-go/
│       ├── cmd/syncflow-sidecar/
│       ├── internal/
│       ├── go.mod
│       └── migrations/
├── packages/
│   ├── contracts/
│   └── design-tokens/
├── docs/
└── scripts/
```

## 5. 关键实现原则

### 5.1 共享的只有“协议与设计 token”，不是 UI 组件
跨端共享：
- contracts
- error codes
- status enums
- event names
- protocol version
- color / spacing / radius / shadow tokens（必要时）

不跨端共享：
- React 组件
- RN 组件
- 页面布局实现
- 路由实现

### 5.2 Mobile 端必须原生优先
凡是以下能力，必须下沉原生：
- Bonjour 发现
- 连接码绑定
- PhotoKit 扫描
- 增量判断
- 断点续传
- 后台任务
- TCP 连接与上传
- 长时间同步状态持久化

RN 只负责：
- 页面
- 展示态 store
- 页面导航
- 用户反馈

### 5.3 Desktop 端必须 sidecar 优先
Go sidecar 负责：
- Bonjour 广播
- TCP 接收
- 配对
- 文件落盘
- SQLite
- SMB 共享状态探测
- Dashboard / ledger 数据聚合 API

Electron 负责：
- 页面
- 系统壳
- 打开文件夹
- 显示路径 / 共享地址 / 设置项
- 事件订阅

## 6. 最重要的风险提示

### 6.1 自定义 TCP + iPhone 长时间后台上传
这是当前方案里最大的技术风险。

工程要求：
- 所有 iOS 传输逻辑必须包在 `TransportDriver` 抽象后面。
- 当前实现名：`TcpLanDriver`
- 预留回退实现名：`HttpBackgroundUploadDriver`

即使当前版本继续做自定义 TCP，也绝不能把协议直接写死到所有业务层。

### 6.2 不要先重 UI
先打通：
- 搜索设备
- 输入连接码绑定
- 自动扫描新增媒体
- 串行上传
- PC 接收
- PC Dashboard 刷新
- Mobile 历史汇总累加

然后再抛光动效、毛玻璃、阴影、渐变。

## 7. 开发顺序

1. 初始化 Greenfield 仓库
2. 建 contracts 包
3. 建 Go sidecar 骨架
4. 建 Electron 壳与 sidecar 管理
5. 建 RN bare app + TurboModule spec
6. 建 Swift SyncEngine 骨架
7. 打通 Bonjour + 连接码绑定
8. 打通单文件串行上传
9. 打通断点续传 + 历史账本
10. 打通后台续传与 SMB 展示
11. 最后对齐 UI 视觉细节

## 8. 完成标准

最小可演示链路：
- 手机启动自动发现附近 Mac
- 选择设备并输入 6 位连接码
- 绑定成功后自动扫描新增图片 / 视频
- 单文件串行上传到 Mac
- Mac Dashboard 卡片出现并实时更新
- Device Detail 弹窗能打开文件夹与打开文件
- Mobile 历史记录按“日期 + 设备”聚合
- App 切后台后继续同步（按当前系统能力最大化实现）
- Mac 设置页可看到共享目录与 SMB 地址 / 引导
