# Vivi Drop 資料模型與統計口徑

本文件記錄 mobile / sidecar 兩端的核心持久化結構、身份語意和統計口徑。

## 1. 身份語意

### 1.1 設備身份

- **iPhone 身份**：`clientId`
- 由 mobile 生成並持久化在 Keychain
- desktop 端識別「是不是同一台手機」依賴它，而不是設備名或 IP

### 1.2 設備顯示名

- 系統設備名在 iOS 16+ 並不可靠
- 目前實作會為通用名生成穩定唯一名，例如 `iPhone 9C2A`
- 使用者手動修改的顯示名保存在 Keychain

### 1.3 雙端 `deviceId`

共享 `HistoryLedgerCardDTO` 的 `deviceId` 在兩端方向不同：

- desktop：`deviceId = iPhone clientId`
- mobile：`deviceId = desktop serverId`

讀程式碼時必須注意這個方向差異。

## 2. Sidecar 資料庫

sidecar SQLite 初始遷移定義在：

- `services/sidecar-go/internal/store/migrations/001_initial.sql`

### 2.1 `paired_devices`

用途：

1. 保存已綁定設備
2. 保存 `client_name / device_alias / last_ip / pairing_id / pairing_token_hash`
3. 作為 dashboard 和 detail 的設備主索引

### 2.2 `sessions`

用途：

1. 目前 sidecar 視角的同步會話
2. 記錄 `state / active_file_key / active_offset / started_at / updated_at`

### 2.3 `uploads`

用途：

1. 每個 `file_key` 一條最終上傳記錄
2. 記錄最終路徑、hash、完成時間、傳輸耗時、已提交位元組數

關鍵欄位：

- `status`
- `part_path`
- `final_path`
- `committed_bytes`
- `active_transmission_ms`
- `completed_at`
- `updated_at`

### 2.4 `device_daily_stats`

用途：

1. 按「設備 + 日期」聚合完成記錄
2. 為 desktop dashboard/history 提供快速統計

關鍵欄位：

- `stat_date`
- `client_id`
- `client_name_snapshot`
- `client_ip_snapshot`
- `file_count`
- `total_bytes`
- `active_transmission_ms`

### 2.5 `settings` / `share_config`

用途：

1. sidecar 基礎設定
2. 共享目錄檢測與 SMB URL 狀態

## 3. Mobile 資料庫

mobile SQLite 由 `UploadStore.swift` 管理。

### 3.1 `binding`

用途：

1. 目前綁定的 desktop 資訊
2. 包括 `device_id / host / port / pairing_id / share_name / last_bound_at`

### 3.2 `upload_items`

用途：

1. 本地上傳佇列和檔案級狀態機
2. 目前同步主循環的真實數據來源

關鍵欄位：

- `asset_local_id`
- `modified_at`
- `media_type`
- `original_filename`
- `file_key`
- `file_size`
- `status`
- `temp_file_path`
- `acked_offset`
- `last_error_code`
- `updated_at`

重要約束：

- pending 佇列來自 `status in ('queued','discovered','preparing','ready','cloud_downloading','uploading')`
- 真實上傳集合必須從這裡取
- 不能只拿「本輪新掃描的素材」做上傳集合

### 3.3 `sync_sessions`

用途：

1. mobile 視角的同步會話快照
2. 保存 `queue_total_count / queue_total_bytes / completed_count / completed_bytes / active_file_key`

### 3.4 `daily_ledgers`

用途：

1. mobile 歷史頁和首頁統計
2. 保存「哪台 desktop、哪一天、傳了多少」

關鍵欄位：

- `ledger_date`
- `device_id`
- `device_name_snapshot`
- `device_ip_snapshot`
- `file_count`
- `total_bytes`
- `active_transmission_ms`

## 4. 統計口徑

## 4.1 「屬於哪一天」

目前統一口徑：

- 以 **sidecar / desktop 完成日** 為準

原因：

1. 真正落盤發生在 desktop sidecar 接收目錄
2. desktop 統計本來就依賴 sidecar
3. mobile 過去用 UTC 自己分桶，曾導致與 desktop 分桶錯位

目前實作：

1. sidecar 在 `FILE_END_RES` 返回 `ledgerDate`
2. mobile 優先使用這個 `ledgerDate`
3. 只有異常 fallback 才用本地日期

## 4.2 「完成時間」

desktop detail 的完成時間來自：

- 優先 `uploads.completed_at`
- fallback 時用 `updated_at` 或檔案系統 `modTime`

注意：

- UI 目前默認只顯示到分鐘 `HH:mm`
- 因此一批在同一分鐘內完成的檔案，看起來可能都是同一個時間

## 4.3 佇列數量

- mobile 首頁佇列數字來自本地 `upload_items` pending 集合
- sidecar 的 `queueCount` 來自目前同步會話 `SYNC_BEGIN_REQ`

這兩個值理論上應一致。

如果出現：

- UI 佇列很多
- sidecar `queueCount=1` 或 `0`

通常說明 app 主循環的數據來源錯了，而不是 sidecar 丟數據。

## 5. 檔案系統佈局

默認接收根目錄：

- macOS：`~/Library/Application Support/Vivi Drop/received`
- Windows：`%AppData%\\Vivi Drop\\received`

以上默認值來自 sidecar 的 `os.UserConfigDir()/Vivi Drop/received`。

實際佈局：

```text
received/
  <devicePath>/
    <YYYY-MM-DD>/
      <original file>
```

說明：

1. `storagePath` 指接收根目錄
2. `devicePath` 指設備自己的目錄
3. desktop detail「打開資料夾」應優先打開 `<devicePath>/<selectedDate>`

## 6. 設備重命名與目錄名

目前約束：

1. desktop 識別設備靠 `clientId`
2. 設備名變化不應把設備識別成新設備
3. 磁碟目錄遷移不是 UI rename 的唯一觸發條件；需要看 sidecar 實際落盤和目錄重命名邏輯

讀程式碼時不要把：

- 設備名
- IP
- 目前目錄名

誤認為是設備主鍵。

## 7. iCloud 素材

iCloud 素材有特殊處理，但不改變資料模型主鍵：

1. 掃描時照常入隊
2. 匯出時允許系統從 iCloud 下載到本地臨時檔案
3. 佇列項可帶 `isCloudAsset` 標識
4. 匯出階段會進入 `cloud_downloading` 狀態

這意味著：

- iCloud 素材會影響「準備時間」
- 但不應改變 `queueCount` 的統計語意
