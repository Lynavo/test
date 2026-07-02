# Lynavo Drive 产品约束与非目标

本文件把当前项目的核心产品约束从工程语言翻译成产品语言，方便交接时统一判断边界。

## 1. 当前产品边界

Lynavo Drive V2 当前做两件事：

- `Mobile（iOS / Android） -> Desktop（macOS / Windows）` 的局域网增量同步（自动扫描 + pending queue）
- 桌面端共享文件供移动端浏览和下载

明确不在当前范围内：

1. 云端中转/云备份
2. 多文件并发上传
3. 手动选择文件替代自动增量同步

补充说明：

- macOS / Windows 都属于当前桌面端范围，iOS / Android 都属于当前移动端范围
- 不要求所有辅助能力在两个平台上完全同构；平台差异以当前实现为准，例如 Windows 的共享地址以手动配置为主
- Linux 桌面端保留本机构建 / 打包验证路径，功能覆盖以当前代码和测试矩阵为准

## 2. 开源版能力边界

当前仓库是单一 OSS baseline，不维护多市场发行路径，也不包含官方账号 / 远程访问 runtime。

开源版必须保留：

1. guest local LAN mode：未登录、未订阅用户仍可在前景 LAN 场景发现 desktop、配对并自动同步
2. 前景 LAN 自动同步：上传集合来自 mobile 本地 pending queue
3. 桌面端本地 received / shared 目录浏览与下载
4. 只读队列和单文件串行上传
5. 本地诊断导出，不依赖官方远端上传服务

开源版不提供：

1. 市场分支、市场切换、专属 release profile 或双市场回归矩阵
2. 官方账号、订阅、server entitlement、付费状态恢复和社交登录 runtime
3. remote access outside local LAN、relay、tunnel credentials 或 cloud-assisted route
4. background silent continuation / background upload beyond foreground LAN recovery
5. 手动选择文件、手动挑选本轮上传集合或手动调整 pending queue
6. Apple Bonjour for Windows 二进制再分发；Windows native Bonjour 只依赖用户本机安装或本机允许来源配置，源码包缺失时使用 zeroconf-compatible fallback

失败策略：

1. foreground LAN fail-open：登录态、订阅态、server entitlement 或非 OSS 模块缺失，不阻断前景 LAN 自动同步
2. remote/background fail-closed：远端访问、tunnel、relay、后台静默续传缺少官方 capability 和有效 entitlement 时必须关闭
3. entitlement 缺失、过期、无法确认或格式异常时，按不可用处理
4. remote/background 检查失败不得清空 LAN pairing、sync identity 或 pending queue

迁移边界：

1. package scope rename
2. mDNS service type 和 sidecar health service rename
3. 旧 data-dir、keychain、shared-preference migration
4. iOS bundle id、Android application id、native package namespace rename
5. 既有公开分发记录 continuity 决策

这些迁移不属于 OSS baseline 文档收敛任务，必须在有独立计划和回滚策略后处理。

## 3. 必须保持的产品约束

### 3.1 上传模型：自动扫描 + pending queue

系统只保留一种上传来源：

1. **自动上传（auto）**：扫描相册、识别未同步素材、自动排队、自动续传和恢复。可配置媒体类型筛选和时间范围

真实上传集合必须来自移动端本地扫描后的 pending queue。产品不提供手动选择文件、手动挑选照片、手动批量提交上传等替代路径。

### 3.2 队列可控性

用户对队列的控制权限：

- **允许**：开启/关闭自动上传
- **不允许**：删除单个队列项、跳过单个项、手动调整顺序、手动标记完成

队列排序由本地 pending queue 的入队/更新时间决定。每个文件完成后重新取队首，不预取整个队列。

### 3.3 单文件串行

同一台手机同一时间只允许传 1 个文件。

原因：

1. 简化状态机和续传逻辑
2. 降低后台和重连场景的复杂度
3. 让历史统计和错误恢复更可解释

### 3.4 以完成为准的历史统计

历史和 dashboard 统计的关键语义是：

- “今天同步了多少”，按 **desktop sidecar 完成落盘** 计算

不是：

- 按拍摄日期
- 按素材创建日期
- 按 mobile 本地 UTC 日期

### 3.5 renderer 隔离

desktop renderer 不直接访问：

1. SQLite
2. sidecar HTTP
3. 文件系统

这不是单纯技术洁癖，而是产品稳定性约束：

- 诊断、权限、打包和 sidecar 生命周期必须可控

## 4. 当前用户承诺

对用户实际承诺的是：

1. 自动发现和绑定桌面端设备
2. 自动增量同步
3. 中断后尽可能自动恢复
4. 开启/关闭自动上传
5. 在 desktop 端能看到进度、历史、存储位置和诊断导出
6. 在移动端可浏览桌面端共享目录中的文件

不是承诺：

1. 云端统一素材管理
2. Linux 桌面端覆盖

## 5. 体验优先级

当前阶段优先级排序：

1. **正确性**：不丢文件、不乱记历史、不重复写坏文件
2. **恢复能力**：断网、重启、回到前景后能继续
3. **可解释性**：状态提示、诊断导出、历史统计可读
4. **性能**：在上述前提下尽量快

这意味着：

- 不要为了 UI 更丝滑轻易牺牲 ACK 或传输稳定性

## 6. 当前高级功能的定位

### 6.1 共享目录

桌面端 `shared/` 目录与 `received/` 目录同级，启动时自动创建。移动端通过 sidecar HTTP 端点浏览、预览和下载共享文件。

当前平台差异：

- macOS：可结合系统文件共享做自动检测
- Windows：以手动配置共享为主，UI 提供快速入口和推荐地址

### 6.2 诊断导出

诊断导出是本地排障工具。使用者决定是否分享，公开分享前应脱敏路径、设备名、
IP、文件名和本地数据库内容。

## 7. 后续扩展时的判断原则

如果有人提出新需求，先问：

1. 会不会绕过自动扫描和 pending queue 引入手动文件选择路径？
2. 会不会引入并发上传、破坏单文件串行约束？
3. 会不会让历史和状态语义更难解释？
4. 会不会让 renderer 绕开 main/preload/sidecar 边界？

任一答案为”会”，就应先审慎评估，而不是直接做。
