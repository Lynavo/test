# Lynavo Drive OSS Verification Matrix

本文件记录长期 OSS baseline 的验证范围、执行方式和验收口径。它不是产品规格；
实际行为以当前代码和 `@lynavo-drive/contracts` 为准。

## 1. 目标

OSS baseline 需要持续确认 4 类能力：

1. 基础可用：发现、配对、扫描、上传、完成
2. 异常恢复：断线、重连、断点续传、进程重启后继续
3. OSS 边界：guest/local 前景 LAN 同步 fail-open；远程访问、官方 tunnel、
   后台静默续传等非 OSS 能力保持关闭
4. 本地可构建：共享包、sidecar、mobile 类型检查、移动端原生构建和 desktop
   package verification 可复现

## 2. 自动化验证

### 2.1 Sidecar

执行命令：

```bash
cd services/sidecar-go
go test ./...
```

关键用例：

| 用例                 | 位置                                  | 覆盖点                                   |
| -------------------- | ------------------------------------- | ---------------------------------------- |
| 默认配置加载         | `internal/config/config_test.go`      | 默认端口、目录、设备名                   |
| 完整配对+传输        | `internal/server/connection_test.go`  | `HELLO -> PAIR -> SYNC -> FILE_END`      |
| 断线后续传           | `internal/server/connection_test.go`  | 部分写入、重连、`RESUME`、最终 hash 正确 |
| ACK 定时 flush       | `internal/server/connection_test.go`  | 没有新 frame 时仍能按间隔发 ACK          |
| 错误路径             | `internal/server/connection_test.go`  | 错误连接码、重复文件、hash mismatch      |
| FileWriter 续传 seek | `internal/server/file_writer_test.go` | `.part` 恢复后写指针正确                 |

### 2.2 Mobile 类型与原生构建

执行命令：

```bash
pnpm --filter @lynavo-drive/mobile exec tsc --noEmit

cd apps/mobile/ios
xcodebuild -workspace LynavoDrive.xcworkspace -scheme LynavoDrive -configuration Debug -destination 'generic/platform=iOS' build
xcodebuild -workspace LynavoDrive.xcworkspace -scheme LynavoDrive -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build

cd ../android
./gradlew assembleDebug
./gradlew assembleRelease
```

验收口径：

1. TypeScript 通过
2. iOS Debug 构建通过
3. iOS generic Release source build 通过
4. Android Debug / Release 构建通过

### 2.3 OSS Release Gate

执行命令：

```bash
pnpm gate:release
```

该 gate 覆盖：

1. version manifest 一致性
2. source package 边界
3. 账号、远程访问和后台能力的 OSS 边界扫描
4. legacy name allowlist
5. release/dev script tests
6. release profile dry-run

验收口径：

1. dry-run 只展示本地 iOS / Android / desktop build/package 命令
2. dry-run 不展示 API base、远端诊断提交端点、桌面自动更新端点、上传命令或历史 market
3. GitHub Actions `OSS Release Gate` 只执行 `pnpm gate:release`，不执行 native build 或 desktop package
4. source package 扫描不包含 secrets、诊断包、本地数据库、生成包或第三方专有二进制

## 3. 真机脚本回归

脚本：

- [scripts/ios/lynavo_upload_eval.sh](../../scripts/ios/lynavo_upload_eval.sh)

基础调用：

```bash
bash scripts/ios/lynavo_upload_eval.sh \
  --mode <MODE> \
  --device <DEVICE_UDID> \
  --app com.lynavo.drive.mobile \
  --file-key <FILE_KEY>
```

可复跑模式：

| 模式                     | 目的              | 说明                                           |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `batch`                  | 标准上传回归      | 单轮或多轮传输，观察吞吐与完成状态             |
| `recovery-app`           | App 重启恢复      | 传输中杀 app，再拉起，看是否 `RESUME`          |
| `recovery-sidecar`       | Sidecar 重启恢复  | 传输中重启 sidecar，看是否自动续传             |
| `recovery-late-sidecar`  | Sidecar 晚启动    | app 先进入 backoff，再启动 sidecar，看是否恢复 |
| `recovery-sidecar-pause` | ACK 黑洞/链路冻结 | `SIGSTOP` sidecar 一段时间，再恢复             |
| `recovery-app-suspend`   | App 挂起恢复      | 传输中 suspend app，再恢复                     |
| `all`                    | 全套串跑          | 依次执行上面所有模式                           |

建议最小回归集：

1. `batch`
2. `recovery-sidecar`
3. `recovery-late-sidecar`
4. `recovery-sidecar-pause`
5. `recovery-app`

如改动涉及移动端生命周期、热控或平台原生传输，再追加 `recovery-app-suspend`
和对应手工回归。

## 4. 手工冒烟清单

### 4.1 首次安装与配对

1. 启动 desktop（macOS / Windows 本地包或开发态）和 sidecar
2. 安装 mobile app（iOS / Android）
3. mobile 能发现 desktop
4. 配对成功
5. 首页和设置页显示已连接或可达状态

### 4.2 基础上传

1. 触发一轮真实素材同步
2. 首页进度、速度、队列项正常变化
3. sidecar 收到文件并落盘
4. 完成后首页进入完成态
5. 历史以 sidecar / desktop 完成日分桶

### 4.3 异常恢复

1. 传输中关闭 Wi-Fi 或阻断 sidecar
2. 首页显示重连或等待网络恢复语义
3. 恢复网络或 sidecar 后自动 `RESUME`
4. 不从 0 重传
5. pending queue 不被清空、重排或跳过

### 4.4 前景 LAN 与生命周期补偿

OSS baseline 只承诺前景 LAN 自动同步。切后台、锁屏或系统挂起期间可安全暂停；
回到前景后应通过 pending queue 继续补偿同步。

1. 传输中切后台或锁屏
2. 观察当前文件安全暂停或进入可恢复状态
3. 回到前景后继续扫描 pending queue
4. 已完成文件不重复写坏，未完成文件继续 `RESUME`
5. 不启用官方后台静默续传或远程 tunnel 路径

### 4.5 Guest Local LAN Mode

1. mobile 未登录、无订阅、无 server entitlement
2. desktop 与 mobile 位于同一 LAN
3. mobile 可以发现 desktop、完成配对并触发前景自动同步
4. 上传集合来自 mobile 本地 pending queue
5. UI 不提供手动勾选文件、跳过文件或删除队列项作为替代路径
6. 断网恢复后继续 `RESUME`，不因 guest 身份清空 sync identity 或 pending queue

### 4.6 非 OSS 能力边界

本节是负向边界 sanity check，不是正向功能验收。

1. OSS runtime 不请求官方 tunnel credentials
2. OSS runtime 不展示官方 tunnel 激活入口，也不向 sidecar 下发 credentials
3. 缺少官方平台能力时，后台静默续传入口保持关闭
4. 前景 LAN 同步仍可用，并在回到前景后通过 pending queue 补偿

### 4.7 Windows Desktop

1. 从本地 Windows 包 fresh install
2. 确认 `Lynavo Drive Sidecar TCP`、`Lynavo Drive Sidecar HTTP` 和
   `Lynavo Drive mDNS UDP` 防火墙规则存在，覆盖 `39393/TCP`、`39394/TCP`
   和 `5353/UDP`
3. 设置页能看到 Bonjour 可用状态或 zeroconf-compatible fallback 状态
4. mobile 能发现并配对
5. 触发一轮真实素材同步

### 4.8 Linux Package Verification

Linux 不是当前用户支持平台。OSS baseline 只保留本地 source-build / package
verification；真机配对属于 maintainer experimental，不作为默认验收门槛。

本地 package verification：

1. 在 Linux host 上执行 `pnpm package:desktop:linux`
2. 确认生成 `.deb` 产物
3. fresh install 后启动 app
4. 确认 sidecar health 进入 healthy
5. 确认 `39393/TCP`、`39394/TCP` 可监听，`5353/UDP` 发现路径按当前实现可用

maintainer experimental：

1. 维护者可在明确标记 experimental 的记录中验证 iOS / Android 与 Linux desktop
   的发现、配对和上传
2. 失败不阻断 macOS / Windows desktop 的 OSS baseline 验收
3. 不把 Linux 真机配对写成用户支持承诺

### 4.9 iOS Thermal

如改动涉及 iOS 热控或上传调参，追加以下手工验证：

1. 用长视频或大文件触发持续上传
2. 制造高热场景，确认同步不中断但速度下降
3. serious / critical thermal 下日志出现 `THERMAL_THROTTLE`、`THERMAL_PAUSE`
   或 `THERMAL_RESUME`
4. 热状态恢复后继续 pending queue，不误报为最终失败
5. 新拍摄素材在恢复到可扫描状态后被发现并入队

### 4.10 Same-LAN Wake-on-LAN

本节只验证 same-LAN wake。VPN 只作 fallback 情境，不作主流程；OSS build
不提供 public Wake-on-WAN、router helper 或 relay wake。

前置条件：

1. mobile 和 desktop 已完成配对，且 desktop 清醒时 sidecar 曾下发 wake metadata
2. mobile 与 desktop 在同一 LAN
3. macOS 已开启 `Wake for network access`，或 Windows 已开启 BIOS/UEFI WoL
   与网卡 magic packet wake

验收口径：

1. 打开 `我的电脑` 根目录或点击 `重新连接` 时，才允许尝试 bounded LAN wake
2. app 启动、回前景、或单纯显示离线状态，不应发送 wake packet
3. 成功时 `/health` 恢复，连接状态回到可达
4. 失败时显示 unavailable / offline / backoff，不改动 pending queue
5. 外网无 VPN-LAN fallback 时，不把该能力描述成 public Wake-on-WAN

## 5. 长期验收门槛

常规改动至少满足：

1. 相关单元测试或脚本测试通过
2. `pnpm gate:release` 通过
3. 触及 sidecar 时运行 `go test ./...`
4. 触及 mobile 时运行 TypeScript 检查和对应平台构建
5. 触及 desktop packaging 时运行目标平台 package verification
6. 触及同步状态、队列或恢复链路时完成至少一轮真机或脚本回归

平台补充：

1. Windows packaging 改动至少完成 fresh install + 配对上传冒烟
2. Linux 只要求本地 package verification；真机配对仅作 maintainer experimental
3. iOS thermal 或生命周期改动需追加热控 / 前后台补偿验证
4. Wake-on-LAN 改动需确认 same-LAN wake 是显式操作触发，且失败不影响 pending queue

## 6. 日志与临时产物

真机脚本默认输出：

1. 结果 CSV：`/tmp/lynavo-drive-upload-eval`
2. App / sidecar 日志：`/tmp/lynavo-drive-upload-eval-logs`

这些目录是临时产物，不应该作为版本化测试记录保存，也不应未经脱敏上传到
公开 issue。
