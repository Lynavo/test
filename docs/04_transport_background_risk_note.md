# 04. 传输协议与 iPhone 后台续传风险说明

## 1. 为什么这份说明很重要

当前产品有两个硬目标：

1. iPhone 端要求长时间后台持续上传
2. 数据面要求使用自定义 TCP

这两个目标可以同时追，但它们并不是 iOS 上最稳妥的组合。

## 2. 当前建议

### 2.1 业务层不要直接依赖 TCP
必须抽象：

```text
SyncEngine
  -> UploadOrchestrator
      -> TransportDriver
          -> TcpLanDriver
          -> HttpBackgroundUploadDriver (reserved)
```

### 2.2 当前实现仍做 TcpLanDriver
因为这是当前产品边界。

但工程上必须同时预留：
- 协议适配层
- 文件 session 抽象
- offset / finalize 语义抽象

## 3. 为什么要留回退位

如果后续真实设备测试发现：
- 退后台后 TCP 连接经常被系统挂起
- 锁屏后无法稳定持续
- 大批量素材同步在后台成功率不够

则 iOS 端必须切换到更符合系统能力的后台上传方案。

## 4. 当前实现要求

### 必做
- checkpoint 持久化
- 当前文件 offset 持久化
- 队列状态持久化
- app state 切换监听
- 连接断开后 query offset 重连

### 不允许
- 把 socket 直接耦合到 RN JS 层
- 让页面自己管理上传状态机
- 在多个模块里散落上传断点逻辑

## 5. 测试重点

必须实测：
- 前台连续上传 30GB+
- 切后台 10 分钟 / 30 分钟 / 1 小时
- 锁屏
- 切 Wi-Fi 再恢复
- sidecar 重启后续传
- 手机重新打开 app 后续传

## 6. 结论

当前版本可以继续按“自定义 TCP”推进，但必须：
- 把 iOS 传输层设计成可替换驱动
- 把后台续传当成高风险专项验证
- 不要把协议写死到业务层和 UI 层
