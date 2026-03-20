# 03. 修正后的执行 Backlog（Greenfield 版）

## 总原则

上一版 backlog 里“在已有 UI 项目上增量接入”的任务全部作废。
本版 backlog 默认：**从零搭建工程，再把 UI 参考稿重新实现进去。**

---

## Milestone 0：仓库初始化

### Issue 0.1 根仓库初始化
- 新建 monorepo
- 配置 pnpm workspace
- 配置 TS base config
- 配置 ESLint / Prettier / lint-staged
- 建 docs 目录

### Issue 0.2 packages/contracts 初始化
- 建状态枚举
- 建 DTO
- 建错误码
- 建事件名
- 建协议版本号

### Issue 0.3 packages/design-tokens 初始化
- colors
- spacing
- radius
- shadow/elevation naming
- typography semantic levels

**验收**
- workspace 可安装依赖
- contracts 和 design-tokens 可被 desktop/mobile 引用

---

## Milestone 1：Desktop Greenfield 壳

### Issue 1.1 Electron 主进程骨架
- app lifecycle
- window lifecycle
- preload 挂载
- 开发环境热更新

### Issue 1.2 React renderer 骨架
- 路由
- 页面容器
- 全局 theme
- 占位 Dashboard / Settings / Device Detail Modal

### Issue 1.3 SidecarManager
- 开发模式：拉起本地 Go 进程
- 生产模式：拉起打包 sidecar
- 健康检查
- 崩溃重启
- 日志输出

### Issue 1.4 Desktop Bridge
- preload 暴露 API
- renderer 端 client 封装
- 错误统一处理

**验收**
- Electron 可启动窗口
- 能拉起 sidecar 占位程序
- renderer 能调用 `/health`

---

## Milestone 2：Sidecar Greenfield 壳

### Issue 2.1 Go 程序入口
- `cmd/syncflow-sidecar/main.go`
- 配置加载
- 日志初始化
- 优雅退出

### Issue 2.2 SQLite 初始化
- 配置表
- 设备表
- 文件台账表
- 日聚合表
- 迁移机制

### Issue 2.3 HTTP API 骨架
- `/health`
- `/config`
- `/dashboard/summary`
- `/events/stream`

### Issue 2.4 Bonjour 广播
- 广播 `_mediasync._tcp`
- TXT record：id/name/type/version/authMode
- 网络变化时重建广播

**验收**
- sidecar 独立运行
- Desktop 能拿到 `/dashboard/summary`
- iPhone 能发现 Bonjour 服务

---

## Milestone 3：Mobile Greenfield 壳

### Issue 3.1 RN bare app 初始化
- TS 模板
- iOS 跑通
- 基础 navigation
- 全局 theme

### Issue 3.2 Screen Skeleton
- DeviceDiscoveryScreen
- CodeVerifyScreen
- SyncStatusScreen
- HistoryScreen
- SettingsScreen

### Issue 3.3 Native Module Spec
- `specs/NativeSyncEngine.ts`
- Codegen 配置
- iOS TurboModule 骨架

### Issue 3.4 RN State Layer
- app store
- screen view model mappers
- native event subscription

**验收**
- RN app 能跑
- JS 层可调用 Native 模块占位方法
- 5 个页面骨架与导航存在

---

## Milestone 4：绑定链路

### Issue 4.1 iOS Bonjour 浏览
- 扫描附近设备
- 输出名称 / IP / 类型 / 状态
- 列表排序与去重

### Issue 4.2 连接码验证
- 6 位输入格
- 第 6 位自动触发校验
- 成功绑定
- 失败清空 + 震动

### Issue 4.3 Sidecar 配对 API / TCP 握手
- pin challenge
- token 签发
- 已绑定设备记录

**验收**
- 手机可发现 Mac
- 输入连接码后绑定成功
- 双端都持久化绑定结果

---

## Milestone 5：自动扫描与串行上传

### Issue 5.1 PhotoKit 扫描器
- 读权限处理
- 首次全量索引
- 后续增量扫描
- 图片 / 视频过滤

### Issue 5.2 本地去重索引
- asset local identifier
- size
- creation date
- quick fingerprint
- upload state

### Issue 5.3 TCP 传输驱动
- 单连接
- init file
- query offset
- append data
- finalize

### Issue 5.4 Sidecar 文件接收
- 临时文件 `.part`
- offset 检查
- flush
- finalize rename
- 台账写入

### Issue 5.5 串行调度器
- 队列只读
- 一次只上传 1 个文件
- 当前文件结束后切下一个

**验收**
- 绑定后自动开始扫描新增媒体
- 手机端队列只读
- PC 端能接收并落盘
- 断网重连后可从 offset 续传

---

## Milestone 6：Dashboard / Detail / History 真数据接入

### Issue 6.1 Desktop Dashboard API
- 今日接收文件数
- 今日占用空间
- 剩余可用空间
- 告警条
- 设备卡片状态排序

### Issue 6.2 Desktop Device Detail API
- 当日设备统计
- active transmission time
- 文件台账倒序
- 打开文件夹 / 打开文件

### Issue 6.3 Mobile Sync Status
- 当前进度
- 传输速率
- 已完成/总量
- 队列列表

### Issue 6.4 Mobile History 聚合
- 按天分组
- 同日同设备合并
- ACTIVE_TRANSMISSION_TIME 累加

**验收**
- 截图里的主要页面都能接真数据
- 历史记录不生成碎片卡片
- 设备详情不出现搜索框

---

## Milestone 7：后台续传与自愈

### Issue 7.1 iOS 后台策略接入
- 前台启动同步
- 切后台时尽可能续传
- 任务过期保存 checkpoint
- 前台恢复自动继续

### Issue 7.2 Sidecar 会话恢复
- socket 断开回收
- upload session 保活
- 重新连接继续查询 offset

### Issue 7.3 错误恢复策略
- 网络波动
- 磁盘空间不足
- 权限异常
- 文件不可读

**验收**
- App 切后台后不中断或能快速接续
- 单文件失败不拖垮整队列
- 剩余空间 < 500MB 时 sidecar 暂停接收

---

## Milestone 8：SMB 共享能力

### Issue 8.1 Sidecar 共享状态检测
- 检测共享目录配置
- 读取或推导 SMB 地址
- 输出状态给 Desktop

### Issue 8.2 Desktop 设置页
- 接收目录
- 共享地址展示
- 复制按钮
- 打开系统设置引导

### Issue 8.3 共享文档与引导
- 如何开启 File Sharing
- 如何开启 SMB
- 如何把目标目录加入共享

**验收**
- 设置页可展示共享状态
- 用户可复制 SMB 地址
- 系统未开启时给出清晰引导

---

## Milestone 9：收尾与发布准备

### Issue 9.1 打包与签名
- Desktop dev / prod 构建
- sidecar 嵌入或随包分发
- Mobile debug / release 构建脚本

### Issue 9.2 观测与日志
- 双端日志落地
- sidecar 事件日志
- iOS 引擎状态日志

### Issue 9.3 QA 场景
- 绑定成功 / 失败
- 大文件断点续传
- 后台恢复
- 磁盘不足暂停
- 多设备 Grid 展示

**最终验收**
- 从零安装后，整条链路可在真实局域网环境跑通
