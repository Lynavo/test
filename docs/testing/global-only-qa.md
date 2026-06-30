# Lynavo Drive Global-only QA

本文补充 global-only OSS/commercial split 的专项 QA。基础 beta 回归仍以 `docs/testing/beta-test-matrix.md` 为主。

## Release Profile Smoke

必须验证：

```bash
pnpm release --profile review --targets ios,android,mac,win,linux --dry-run
pnpm release --profile prod --targets ios,android,mac,win,linux --dry-run
```

验收口径：

1. 只出现 `review` / `prod` release channel。
2. `review` 指向 review API。
3. `prod` 不指向 review API。
4. dry-run 输出不要求或展示历史 market。

## Guest Local LAN

场景：

1. fresh install mobile。
2. 不登录账号，不购买订阅。
3. desktop 与 mobile 在同一 LAN。
4. mobile 发现 desktop 并完成配对。
5. 触发一轮真实素材同步。

预期：

1. 前景 LAN 同步可用。
2. 上传集合来自 pending queue。
3. 断线恢复走 `RESUME`。
4. 不清空 sync identity、pairing 或 pending queue。
5. 没有手动选档入口。

## No Manual-file-selection Replacement

检查所有上传入口：

1. 不允许用户手动勾选文件作为同步集合。
2. 不允许用手动上传按钮绕过自动扫描和 pending queue。
3. 不允许用户从 UI 删除、跳过或重排 pending queue item。

如果需要 debug 特定文件，应使用诊断或测试脚本，不作为产品路径暴露。

## Paid Remote/background Boundary

无 entitlement、expired entitlement、server error、official capability missing 都要覆盖。

预期：

1. remote access 不请求或不使用 tunnel credentials。
2. background silent continuation 不启用。
3. community / OSS runtime 不展示官方 remote tunnel 激活入口。
4. 前景 LAN 同步仍可用。
5. 回到前景后继续 pending queue 补偿。

## Deferred Migration Checks

本轮不要求迁移这些名称或路径，但 QA 记录里要明确它们是兼容项：

1. package scope。
2. mDNS service type。
3. sidecar health service name。
4. data-dir / keychain / shared-preference legacy paths。
5. iOS / Android native package identifiers。
