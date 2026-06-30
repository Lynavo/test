# 2026-05-22 Vivi Drop App 重新命名與真機運行設計文檔

## 1. 目標

將 iOS App 的中國區（CN）和全球區（Global）顯示名稱修改為 "Vivi Drop"，並將全球區版本運行至使用者的實體 iPhone 上。

## 2. 設計方案

### 2.1 修改檔案

#### `apps/mobile/ios/SyncFlowMobile/Info.plist`

將 `CFBundleDisplayName` 與 `CFBundleName` 從動態的 `$(PRODUCT_NAME)` 改為靜態的 `Vivi Drop`，以確保預設顯示名稱正確。

```xml
<key>CFBundleDisplayName</key>
<string>Vivi Drop</string>
<key>CFBundleName</key>
<string>Vivi Drop</string>
```

#### `apps/mobile/ios/en.lproj/InfoPlist.strings`

新增英文語系下的 Bundle Display Name：

```strings
"CFBundleDisplayName" = "Vivi Drop";
"CFBundleName" = "Vivi Drop";
```

#### `apps/mobile/ios/zh-Hans.lproj/InfoPlist.strings`

新增簡體中文語系下的 Bundle Display Name：

```strings
"CFBundleDisplayName" = "Vivi Drop";
"CFBundleName" = "Vivi Drop";
```

### 2.2 運行真機

#### 目標裝置

- 裝置名稱：`Open IM’s iPhone`
- 裝置 ID (UDID)：`00008101-001E74E03C42001E`

#### 運行 Scheme / Mode

- Scheme: `SyncFlowMobileGlobal`
- Mode (Configuration): `DebugGlobal`

#### 運行指令

在 `/Volumes/T7/Dev/Web/SyncFlow/apps/mobile` 下執行：

```bash
npx react-native run-ios --device "Open IM’s iPhone" --scheme "SyncFlowMobileGlobal" --mode "DebugGlobal"
```

## 3. 驗證計劃

1. 確保 App 在真機上成功編譯並安裝。
2. 檢查真機桌面上的 App 圖示下方顯示名稱是否為 "Vivi Drop"。
3. 檢查系統設定（或多語言切換）時，顯示名稱是否均能正確顯示為 "Vivi Drop"。
