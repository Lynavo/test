# Lynavo Drive Commercial Feature Boundary

本文定义官方商业能力和开源 community baseline 的边界。实现和验收时以 fail-open foreground LAN、fail-closed remote/background 为原则。

## Baseline

所有发行形态都必须允许：

1. guest local LAN mode。
2. 前景 LAN 自动同步。
3. 从 mobile 本地 pending queue 构建真实上传集合。
4. 只读队列和单文件串行上传。

这些能力不需要登录、订阅或官方商业模块。

## Paid / Official Capabilities

以下能力属于官方商业范围：

1. Remote access outside local LAN。
2. Tunnel credentials、relay 或 cloud-assisted route。
3. Background silent continuation / background upload beyond normal foreground recovery。
4. 官方订阅、账号、server entitlement 下发和付费状态恢复。

商业能力启用必须同时满足：

1. 用户具备有效 entitlement。
2. entitlement 未过期，或明确为 non-expiring grant。
3. 当前 build 具备 official capability module。
4. API 返回可验证；网络失败、字段缺失或解析失败不得默认放行。

## Required Failure Behavior

Foreground LAN fail-open：

1. guest/free/expired 用户仍可在前景 LAN 内同步。
2. remote/background entitlement 检查失败不得清空 LAN pairing、sync identity 或 pending queue。
3. 前景恢复后继续处理 pending queue。

Remote/background fail-closed：

1. guest/free/expired 用户不得请求 tunnel credentials。
2. stale tunnel credentials 在 entitlement 缺失或过期时必须清理或停止使用。
3. background continuation 缺少 official native capability 时不得启用。
4. UI 应区分 subscription/capability unavailable 与普通网络失败。

## Release And QA Impact

发布只使用两个 profile：

```bash
pnpm release --profile review --targets ios,android,mac,win,linux
pnpm release --profile prod --targets ios,android,mac,win,linux
```

QA 至少覆盖：

1. guest local LAN 前景同步。
2. paid official build 的 background/remote 正向路径。
3. community/free/expired 的 remote/background fail-closed。
4. 回到前景后的 pending queue 补偿。

## Out Of Scope For This Migration

本文不要求执行 package rename、mDNS/data-dir migration、native package rename 或 store listing migration。这些属于后续独立任务，必须在有明确迁移计划和回滚策略后处理。
