# 05. React Web -> React Native 转换清单

## 1. 总原则

Mobile 端虽然也“是 React”，但它不是浏览器 DOM。

因此：
- 只能复用**页面结构与设计语义**
- 不能直接复用大部分 UI 组件实现

## 2. 组件映射

| Web React | RN 对应 | 说明 |
| --- | --- | --- |
| `div` | `View` | 容器 |
| `span` / `p` / `h1-h6` | `Text` | 文字必须放在 `Text` 中 |
| `img` | `Image` | 网络图 / 本地图都要适配 |
| `button` | `Pressable` / `TouchableOpacity` | 建议统一 `Pressable` |
| `input` | `TextInput` | 连接码输入页需做自动聚焦 |
| `ul/li` | `FlatList` / `SectionList` | 历史页按天分组用 `SectionList` |
| `table` | `FlatList` + 自定义 row | RN 不做 Web table |
| portal modal | `Modal` / native stack modal | 交互另行适配 |

## 3. 布局差异

### Web 可直接做的
- CSS Grid
- sticky
- hover
- 复杂 filter / backdrop

### RN 不能直接照搬的
- 复杂 CSS Grid
- hover 交互
- 浏览器滚动条语义
- 浏览器尺寸监听方式
- table 布局

### RN 推荐做法
- 用 Flexbox 重写布局
- 列表页面用 `FlatList` / `SectionList`
- 状态页用 `ScrollView` + 分块卡片

## 4. 样式差异

### 不可直接复用
- CSS 文件
- Tailwind class
- styled-components for web 的 DOM 样式
- `backdrop-filter`

### 需要重写
- 阴影
- 毛玻璃
- 渐变
- 边框发光
- 行高与字重细节

## 5. 交互差异

### Web 交互不能照搬
- hover 显示按钮
- 鼠标滚轮
- 键盘快捷键
- 多列复杂表格选择

### Mobile 需要补做
- safe area
- 返回手势 / 返回按钮
- 键盘弹出与收起
- 数字键盘自动唤起
- 震动反馈
- AppState 前后台切换

## 6. 逐屏转换要点

### 6.1 搜索设备页
- Web 卡片列表 -> RN `FlatList`
- 设备项点击 -> 进入连接码页
- 自动刷新列表 -> native event 驱动

### 6.2 连接码页
- 6 个输入格可做成受控组件
- 第 6 位输入后自动提交
- 失败后清空并触发 haptic

### 6.3 同步动态页
- 环形进度建议单独封装原生友好组件
- 队列列表用 `FlatList`
- 当前状态与速率通过 native event 推送

### 6.4 历史记录页
- 按天分组必须用 `SectionList`
- 同天同设备卡片合并在 native / domain 层先聚合
- 页面只做展示

### 6.5 设置页
- 设备头部卡片
- 断开连接按钮
- 不做复杂表单

## 7. 动效与视觉还原顺序

1. 先做静态布局
2. 再接真数据
3. 再补 loading / empty / error state
4. 再补环形进度动画
5. 最后补光效、阴影、模糊

## 8. 代码审查清单

出现以下情况一律退回：
- 直接复制 Web JSX 到 RN 页面
- 直接沿用 DOM 结构命名并夹带 CSS 类名
- 在 RN 页面内自己维护上传业务状态机
- 使用随机 mock 数据驱动核心页面
- 把 PhotoKit / Bonjour / socket 逻辑写进 JS 页面
