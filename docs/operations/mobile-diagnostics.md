# Mobile 诊断包说明

本文件说明 mobile 端“导出诊断包”当前包含什么、怎么看、有什么限制。

## 1. 导出形式

mobile 端诊断包导出为一个 zip 文件，命名类似：

- `Lynavo Drive-Mobile-Diagnostics-20260325-214928.zip`

导出入口：

- app 设置页
- `支持与诊断 -> 导出诊断包`

导出后走系统分享面板。使用者自行决定是否分享给维护者；公开 issue
中不要直接上传未脱敏诊断包。

隐私原则：

1. 诊断包是本地文件，不会由 OSS runtime 自动上传到远端服务。
2. 分享前应检查并按需脱敏本机路径、设备名、IP 地址、文件名和错误上下文。
3. `lynavo-drive.db` / `*-wal` / `*-shm` 属于高敏感材料；只有在使用者明确
   opt in，且排障确实需要数据库快照时才应包含或分享。
4. 如果只需要普通排查，优先分享 `diagnostics.json`、`queue.json` 和
   `engine.log` 的脱敏片段。

## 2. 当前包含的文件

### 2.1 `diagnostics.json`

核心运行时快照，包含：

1. `generatedAt`
2. `app`
   - app 名称
   - 版本号
   - build number
3. `device`
   - mobile 设备信息
4. `client`
   - `clientId`
   - 当前显示名
   - 是否存在 pairing token
   - 当前优选 IPv4
5. `runtime`
   - `applicationState`
   - `bindingState`
   - `syncOverview`
   - `queueCount`
   - `photoAuthorization`
   - `sidecarHost`
   - `activeSession`
   - `recentRetry`
   - `recentError`
6. `thermal`（syncOverview 内）
   - `thermalState`：当前热状态（nominal / fair / serious / critical）
   - `activeTuningProfile`：`resolvedUploadTuning()` 输出的档位标签（normal / background / background_thermal / active_capture / thermal_serious / thermal_critical / low_power / windows_safe 等组合）
   - `isThermalLimited`：是否正在降速
   - `performanceHint`：UI 层提示类型（none / thermal_limited）

   注：传输中途暂停（thermal critical pause）不会改变 `activeTuningProfile`，而是通过 diagnostics log 中的 `THERMAL_PAUSE` / `THERMAL_RESUME` 事件体现

### 2.2 `queue.json`

当前只读 pending 队列快照。

每条至少包含：

- `fileKey`
- `filename`
- `fileSize`
- `mediaType`
- `status`
- `isCloudAsset`

用途：

1. 判断是否真的还有很多 pending
2. 判断当前是否有 `uploading / preparing / cloud_downloading`
3. 判断问题是不是 iCloud 素材

### 2.3 `history.json`

当前 mobile 历史页快照，用于判断：

1. 历史是否有记录
2. 分桶是否正常
3. 设备名/IP 是否错位

### 2.4 `engine.log`

原生日志 ring buffer 快照。

重点模块：

- `SyncEngine`
- `DiscoveryService`
- `SyncPipeline`
- `SyncUpload`
- `Diagnostics`

### 2.5 `lynavo-drive.db`

mobile 本地 SQLite 快照。

如存在，也会同时带上：

- `lynavo-drive.db-wal`
- `lynavo-drive.db-shm`

数据库快照可能包含本地队列、路径、文件名、设备标识和历史记录。它只应在
使用者明确 opt in 时包含或分享；公开 issue 中不要上传完整数据库。

## 3. 当前关键字段解释

### 3.1 `runtime.bindingState`

用于看当前绑定和连接层状态。

最关键字段：

- `deviceId`
- `deviceName`
- `deviceAlias`
- `host`
- `port`
- `connectionState`
- `wake`（iOS / JS binding payload 可能包含完整 paired wake metadata）
- `wakeSupported` / `wakeTargetCount`（Android diagnostics 以摘要形式暴露，避免排障包過度依賴完整 targets）

Wake-on-LAN 判讀口徑：

1. `wake.supported=true` 且有可用 targets，代表 mobile 曾在 desktop 清醒時收到可快取的 LAN wake metadata
2. `wakeSupported=false` 或 `wakeTargetCount=0`，代表目前沒有可用 wake metadata；此時打開 `我的電腦` 或按 `重新連接` 仍應回到既有離線/重連流程
3. metadata 可能因桌面換網路、DHCP 變更、換網卡或路由器變更而過期；不要只看欄位存在就判定喚醒一定會成功
4. 這個 metadata 只代表 same-LAN WoL 能力；OSS build 不提供 public Wake-on-WAN、router helper 或 relay wake，VPN 只作 fallback

### 3.2 `runtime.syncOverview`

用于看当前 UI 看到的同步概览。

最关键字段：

- `currentDeviceId`
- `currentDeviceName`
- `currentSpeedMbps`
- `transferredBytes`
- `totalBytes`
- `progressPercent`
- `uploadState`
- `performanceHint`
- `performanceMessage`
- `thermalState`
- `activeTuningProfile`
- `isThermalLimited`

### 3.3 `runtime.activeSession`

用于判断是否真的处在活跃同步轮次内。

包含：

- 当前 `sessionId`
- 当前 `state`
- 当前活跃队列项
- 如本地 DB 中有活跃持久化会话，也会附上 `persistedSession`

### 3.4 `runtime.recentRetry` / `runtime.recentError`

用于判断最近一次：

- 重试发生在什么时候
- 是因为什么进入 retry
- 最近一次错误是什么

这对“提示连接失败，但几秒后又恢复”“频繁重连”“某轮上传突然停住”很关键。

### 3.5 热控相关信号

用于判断这次“变慢”是不是热控策略主动接管，而不是网络或 sidecar 问题。

优先看：

- `runtime.syncOverview.performanceHint`
- `runtime.syncOverview.performanceMessage`
- `runtime.syncOverview.thermalState`
- `runtime.syncOverview.activeTuningProfile`
- `runtime.syncOverview.isThermalLimited`

当前口径：

- `performanceHint = thermal_limited`
  - 代表 mobile 端已经主动降载
- `activeTuningProfile = background_thermal / thermal_serious / thermal_critical`
  - 代表当前限速来自热状态或后台热态保护
- `THERMAL_PAUSE / THERMAL_RESUME`
  - 代表 critical thermal 下的中途短暂停；这是日志事件，不会写入 `activeTuningProfile`

如果 `isThermalLimited = true` 且 `engine.log` 同时出现这些关键字，基本可以判定是热控而不是传输故障：

- `thermal state changed`
- `profile changed`
- `THERMAL_THROTTLE`
- `THERMAL_PAUSE`
- `THERMAL_RESUME`

### 3.6 Wake-on-LAN 相關信號

排查「打開 `我的電腦` 或按 `重新連接` 後是否嘗試喚醒」時，優先看 `engine.log`：

- `wake skipped reason=<reason> metadata_missing_or_unusable`：使用者打開 `我的電腦` 或按 `重新連接`，但 bound desktop 沒有已快取的 wake targets，或 targets 被判定不可用
- `wake packets sent packets=<n>`：mobile 已對 directed / limited broadcast 目的地送出 `<n>` 個 magic packets
- `wake packets sent`：舊版或摘要型日誌，代表 mobile 已送出 magic packet
- `wake LAN reachable host=<ip>` / `wake recovered LAN host`：wake polling 期間，`/health` 已從該 LAN host 恢復可達
- `wake polling exhausted` / `wake probe timed out`：送出 wake packet 後，限定 polling 時間內仍未觀察到 sidecar 恢復
- `retryLanReconnect LAN host unavailable; wake disabled`：使用者按 `重新連接`，但本次呼叫未允許 wake 或沒有可用 LAN host
- `retryLanReconnect wake did not recover LAN host`：`重新連接` 已走 LAN wake retry，但未恢復

這些 `Wake` 診斷只代表 shared-files route selection 或 explicit LAN reconnect recovery，不代表 upload queue 被改動、重排或清空。

行為邊界：

1. app 啟動、回前景、單純顯示離線，不應出現 `wake packets sent`
2. `重新連接` 是 LAN / VPN-LAN retry，不是 public Wake-on-WAN
3. OSS build 不提供 router helper、third-party wake helper、public relay wake 或 peer proxy wake
4. 手機在外部網路且沒有 VPN-LAN fallback 時，喚醒失敗屬於能力邊界，不應視為 upload queue 或 sync state machine 錯誤

## 4. 当前大小控制

当前没有硬上限，但有软控制：

1. `engine.log` 是 ring buffer
2. `diagnostics.json / history.json` 是快照
3. `queue.json` 当前是整份 pending 队列
4. `lynavo-drive.db` 是整库副本

所以体积最不可控的通常是：

1. `queue.json`
2. `lynavo-drive.db`

如果导出的包内包含数据库快照，排障时应优先保护数据库完整性；如果准备公开
分享，则优先删除数据库或只提供脱敏后的关键字段。

## 5. 适合排查的问题

这份包现在足够定位这几类问题：

1. app 到底是不是最新 build
2. 当前是否真的有大量 pending
3. 是不是队列很多但没有真实 `uploading`
4. 当前实际 sidecar 地址是什么
5. 是否是 iCloud 素材
6. 最近一次错误/重试是什么
7. 当前是否真的在一个活跃会话里
8. 当前是否因为热状态而主动降速或短暂停

## 6. 当前限制

仍然有这些限制：

1. 日志是 ring buffer，不保证覆盖很早之前的完整历史
2. 包里没有 sidecar 端信息；需要和 desktop 诊断包配合看
3. 旧历史分桶问题如果已经落进本地聚合表，诊断包只能看到当前结果，不能自动纠偏

## 7. 推荐联动材料

排查时，优先同时准备：

1. mobile 诊断包
2. desktop 诊断包
3. 当时的版本号
4. 简短复现描述

只提供单边材料时，优先级是：

1. `diagnostics.json`
2. `queue.json`
3. `engine.log`
4. `lynavo-drive.db`（仅在使用者明确 opt in 时）
