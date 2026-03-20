# 02. UI 参考项目使用策略（Reference Only）

## 1. 目的

这份文档用于明确：

- v0 UI 项目是**参考资产**，不是当前产品的代码底座。
- 代码 agent 不应尝试“迁仓”或“在旧项目内继续开发”。
- 正确做法是：**提炼设计信息，再在新工程中重建。**

## 2. 可复用与不可复用

### 2.1 可人工复用的内容
- 页面层级
- 版式结构
- 卡片布局
- 间距与留白节奏
- 颜色语义
- 组件命名语义
- 文案与状态标签
- icon 语义
- 弹窗开合路径

### 2.2 仅 Desktop 可能有限复用的内容
- 纯 TS 工具函数（需人工审查）
- 与浏览器无关的常量
- 一部分 SVG 资源

### 2.3 明确禁止直接复用的内容
- CSS Modules / SCSS / Tailwind class
- 基于 DOM 的组件实现
- 依赖 `div/span/img/button/table` 的 JSX 结构
- Web router 实现
- 任何 mock API / fake data / demo 状态
- 任何耦合旧仓库状态管理的 hooks

## 3. 参考转译流程

### Step A：抽取设计 token
把参考项目中的下列内容提取到 `packages/design-tokens`：
- `colors.ts`
- `spacing.ts`
- `radius.ts`
- `elevation.ts`
- `typography.ts`
- `icon-keys.ts`

### Step B：抽取页面信息架构
为每个页面输出一份 `screen spec`：
- 页面名称
- 入口与出口
- 数据来源
- 组件层级
- 状态集合
- loading / empty / error / active / offline 视觉差异

### Step C：再分别实现 Desktop / Mobile
- Desktop：按 Electron Web Renderer 重新实现
- Mobile：按 React Native 重新实现

## 4. 页面级拆解建议

### 4.1 Desktop
#### Dashboard
- 顶部 3 个汇总卡
- 设备 Grid
- 顶部告警条
- PC / Mobile 视图切换器（如仍保留）

#### Device Detail Modal
- 头部设备信息
- 打开文件夹按钮
- 日期过滤器
- 汇总 badge
- 文件台账列表
- 行 hover 操作：仅“打开”

#### Settings
- 连接码管理
- 接收目录
- 共享路径
- 系统权限/共享引导

### 4.2 Mobile
#### Device Discovery
- 顶部标题
- 自动扫描列表
- 列表项：名称 / IP / 类型 / 在线状态

#### Code Verify
- 返回
- 设备标题
- 6 位输入格
- 自动校验与失败震动

#### Sync Status
- 环形进度
- 当前设备连接状态
- 当前速率
- 已完成 / 总量
- 只读队列列表

#### History
- 按天分组
- 同设备单日卡片聚合
- 累加展示 active transmission time

#### Settings
- 已连接设备信息
- 断开连接 / 切换设备

## 5. 设计 token 落地原则

### Desktop
token 可以映射为：
- CSS variables
- TS constants
- design-system theme object

### Mobile
token 可以映射为：
- React Native `StyleSheet`
- theme constants
- platform-aware style helper

## 6. RN 转译的特别注意

下面这些从 Web 到 RN 不能直接照搬：

- `div` / `span` / `img` / `button`
- CSS Grid 复杂排版
- `:hover`
- browser scroll 容器
- table
- backdrop-filter 玻璃效果的实现方式
- 浏览器输入焦点逻辑
- 浏览器文件路径展示

## 7. 视觉还原的优先级

优先级从高到低：
1. 信息层级正确
2. 状态切换正确
3. 交互路径正确
4. 列表与卡片结构正确
5. 间距与排版接近
6. 阴影、模糊、光效、动效细节

## 8. 交付要求

每个参考页面至少产出：
- 1 份 screen spec
- 1 份 state spec
- 1 份 token dependency list
- 1 份 Desktop 实现清单 / Mobile 实现清单
