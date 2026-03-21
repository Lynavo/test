# Phase 5: Mobile App (React Native + Swift) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an iOS app with React Native that discovers Mac sidecar via Bonjour, pairs with 6-digit code, and syncs photos/videos via the LMUP/2 protocol with background execution support.

**Architecture:** React Native bare app (iOS only) with Swift TurboModule for all native operations. JS layer handles only UI rendering and state display. Swift SyncEngine handles Bonjour, TCP transport, PhotoKit scanning, background tasks, and local SQLite persistence. Communication via TurboModule codegen + EventEmitter.

**Tech Stack:** React Native 0.84, TypeScript 5.8, React Navigation 7, Swift 5.9+, Network.framework, PhotoKit, BGTaskScheduler, SQLite (GRDB.swift)

**Spec:** `docs/superpowers/specs/2026-03-21-syncflow-v2-spec.md` — Sections 8, 9, 8.10-8.12

**Depends on:** Phase 2 (Go Sidecar) + Phase 4 (LMUP/2 protocol)

---

## Team Execution Strategy

Phase 5 is split into two parallel tracks after the bootstrap:

```
T5.0 🔁 RN project init + navigation + TurboModule spec
  ├── Track A (JS layer):
  │   T5.1a 🔀 DeviceDiscoveryScreen + CodeVerifyScreen
  │   T5.1b 🔀 SyncStatusScreen
  │   T5.1c 🔀 HistoryScreen + SettingsScreen
  │
  └── Track B (Swift layer):
      T5.2  🔁 Swift SyncEngine skeleton + RNBridge
      T5.3a 🔀 DiscoveryService + BindingService
      T5.3b 🔀 PhotoScanner + AssetExportService
      T5.3c 🔀 TcpTransport (LMUP client)
      T5.3d 🔀 UploadQueueManager + SessionService
      T5.3e 🔀 UploadStore + HistoryLedgerStore (SQLite)
      T5.3f 🔀 BackgroundExecutionService

T5.4 🔁 Wire everything + integration test
```

**Maximum parallelism: 6 agents** (3 JS screens + 3 Swift modules) after T5.0 + T5.2 complete.

---

## File Structure

### JS Layer (apps/mobile/src/)

```
apps/mobile/
  package.json                        NEW
  tsconfig.json                       NEW
  babel.config.js                     NEW
  metro.config.js                     NEW
  app.json                            NEW
  index.js                            NEW
  specs/
    NativeSyncEngine.ts               REWRITE (update to match spec 8.7)
  src/
    App.tsx                           NEW — root with navigation
    navigation/
      RootNavigator.tsx               NEW — Stack navigator
    screens/
      DeviceDiscoveryScreen.tsx       NEW
      CodeVerifyScreen.tsx            NEW
      SyncStatusScreen.tsx            NEW
      HistoryScreen.tsx               NEW
      SettingsScreen.tsx              NEW
    hooks/
      useSyncEngine.ts                NEW — typed wrapper for NativeSyncEngine
    theme/
      colors.ts                       NEW — from @syncflow/design-tokens
      styles.ts                       NEW — shared RN styles
    utils/
      format.ts                       NEW — formatBytes, formatDuration
```

### Swift Layer (apps/mobile/ios/SyncEngine/)

```
apps/mobile/ios/
  SyncFlow/
    Info.plist                        MODIFY (add capabilities)
    AppDelegate.swift                 MODIFY (register BGTasks)
  SyncEngine/
    RNBridge.swift                    NEW — TurboModule implementation
    RNBridge.m                        NEW — ObjC bridge macro
    DiscoveryService.swift            NEW — Bonjour browse
    BindingService.swift              NEW — pairing + Keychain
    SessionService.swift              NEW — sync session management
    PhotoScanner.swift                NEW — PHAsset scanning
    AssetExportService.swift          NEW — PHAsset export to temp
    TcpTransport.swift                NEW — LMUP/2 client
    UploadQueueManager.swift          NEW — serial upload orchestrator
    UploadStore.swift                 NEW — SQLite (upload_items, binding, sync_sessions)
    HistoryLedgerStore.swift          NEW — SQLite (daily_ledgers)
    BackgroundExecutionService.swift  NEW — BGContinuedProcessingTask
    SyncEngineManager.swift           NEW — facade coordinating all services
```

---

## Task 5.0 🔁 RN Project Init + Navigation + TurboModule Spec

**This is the bootstrap — must complete before parallel tracks begin.**

- [ ] **Step 1: Initialize React Native bare app**

```bash
cd /Volumes/workspace/work/sync-flow/apps
npx @react-native-community/cli init SyncFlowMobile --template react-native-template-typescript --directory mobile --pm pnpm
```

If `apps/mobile/` already has files (old placeholder), back them up first.

After init, verify:
```bash
cd mobile && npx react-native run-ios --simulator="iPhone 16 Pro"
```

- [ ] **Step 2: Add to pnpm workspace**

The root `pnpm-workspace.yaml` already includes `apps/*`, so `apps/mobile` should be auto-detected. Update `apps/mobile/package.json` name to `@syncflow/mobile`.

Add dependencies:
```bash
pnpm --filter @syncflow/mobile add @react-navigation/native @react-navigation/stack react-native-screens react-native-safe-area-context react-native-gesture-handler @syncflow/contracts
```

- [ ] **Step 3: Update TurboModule spec**

Rewrite `apps/mobile/specs/NativeSyncEngine.ts` with the spec Section 8.7 interface. The spec has the exact content. Key changes from old placeholder:
- `requestPhotoPermission()` (not `requestPermissions()`)
- `pairDevice(params)` (not `verifyConnectionCode`)
- `getBindingState()` returns `BindingStateDTO | null`
- `getHistoryDays(cursor?)` returns `{ items, nextCursor }`
- 6 EventEmitter declarations

- [ ] **Step 4: Create navigation**

`src/navigation/RootNavigator.tsx`:
```tsx
import { createStackNavigator } from '@react-navigation/stack';

export type RootStackParamList = {
  DeviceDiscovery: undefined;
  CodeVerify: { deviceId: string; host: string; port: number; deviceName: string };
  SyncStatus: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // Check binding state to determine initial route
  // If bound → SyncStatus, else → DeviceDiscovery
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeviceDiscovery" component={DeviceDiscoveryScreen} />
      <Stack.Screen name="CodeVerify" component={CodeVerifyScreen} />
      <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 5: Create placeholder screens (5 files)**

Each screen: simple `<View><Text>ScreenName</Text></View>` with SafeAreaView. Just enough to verify navigation works.

- [ ] **Step 6: Create App.tsx + index.js**

`src/App.tsx`: wrap `RootNavigator` in `NavigationContainer`.
`index.js`: register app component.

- [ ] **Step 7: Create helper files**

`src/hooks/useSyncEngine.ts`: typed import of NativeSyncEngine TurboModule.
`src/theme/colors.ts`: import from `@syncflow/design-tokens`.
`src/utils/format.ts`: copy `formatBytes`, `formatDuration`, `formatDate` from desktop.

- [ ] **Step 8: Verify app runs on simulator**

```bash
cd apps/mobile && npx react-native run-ios
```

- [ ] **Step 9: Commit**

```
feat(mobile): initialize RN bare app with navigation + TurboModule spec
```

---

## Track A: JS Screen Implementations

### Task 5.1a 🔀 DeviceDiscoveryScreen + CodeVerifyScreen

**Can run in parallel with 5.1b, 5.1c, 5.2 after T5.0.**

**Files:**
- Create: `src/screens/DeviceDiscoveryScreen.tsx`, `src/screens/CodeVerifyScreen.tsx`

**Reference:** Spec Sections 8.2, 8.3 + `tmp/ui-demo/components/mobile/scan-page.tsx`, `connection-page.tsx`

- [ ] **Step 1: Create DeviceDiscoveryScreen**

- Header: WiFi icon + "搜索设备" title + subtitle
- Scanning animation: pulsing rings (when no devices yet)
- Device list: FlatList with cards showing device name / IP / type
- Each card: Monitor icon, device name (bold), platform + IP (muted), chevron
- Rescan button
- Data from: `useSyncEngine().startDiscovery()` + `onDiscoveredDevicesChanged` event
- For Phase 5 initial build: use static mock data (native module not wired yet)
- Tap device → navigate to CodeVerify with device params

- [ ] **Step 2: Create CodeVerifyScreen**

- "请输入电脑端显示的 6 位连接码" prompt
- 6 individual TextInput boxes, numeric keyboard
- Auto-focus first, auto-advance on digit entry
- 6th digit triggers auto-submit
- Verifying state: spinner + text
- Error state: clear all + haptic vibration
- Success: navigate to SyncStatus
- For Phase 5: call `useSyncEngine().pairDevice(params)`
- Back button returns to DeviceDiscovery

- [ ] **Step 3: Commit**

```
feat(mobile): DeviceDiscovery + CodeVerify screens
```

---

### Task 5.1b 🔀 SyncStatusScreen

**Can run in parallel with 5.1a, 5.1c.**

**Files:**
- Create: `src/screens/SyncStatusScreen.tsx`

**Reference:** Spec Section 8.4 + `tmp/ui-demo/components/mobile/transfer-page.tsx`

- [ ] **Step 1: Create SyncStatusScreen**

- Header: "同步动态" + History / Settings icon buttons
- Main card with two states:
  - **Transmitting**: SVG circular progress ring + percentage + speed + "已完成 X / Y"
  - **Done**: checkmark icon + "所有文件已同步" + file count · total size
- Read-only queue card (FlatList):
  - "排队中" header + count badge
  - Each item: file type icon + filename + size
  - **No action buttons, no swipe**
- Data from: `useSyncEngine().getSyncOverview()` + `onSyncStateChanged` / `onQueueUpdated` events
- Linear gradient background

- [ ] **Step 2: Commit**

```
feat(mobile): SyncStatus screen with progress ring + queue
```

---

### Task 5.1c 🔀 HistoryScreen + SettingsScreen

**Can run in parallel with 5.1a, 5.1b.**

**Files:**
- Create: `src/screens/HistoryScreen.tsx`, `src/screens/SettingsScreen.tsx`

**Reference:** Spec Sections 8.5, 8.6 + `tmp/ui-demo/components/mobile/history-page.tsx`, `settings-page.tsx`

- [ ] **Step 1: Create HistoryScreen**

- Back button + "历史记录" title
- SectionList grouped by date ("今天" / "昨天" / "X月X日")
- Today section: pulsing dot + "实时同步中"
- Per-device cards: device icon + name + IP + file count · size + duration
- Data from: `useSyncEngine().getHistoryDays()` + `onHistoryUpdated` event

- [ ] **Step 2: Create SettingsScreen**

- Back button + "设置" title
- Device card: icon + editable name + IP + connection status dot
- "断开连接 / 切换设备" button → `disconnectAndUnbind()` → navigate to DeviceDiscovery

- [ ] **Step 3: Commit**

```
feat(mobile): History + Settings screens
```

---

## Track B: Swift SyncEngine

### Task 5.2 🔁 Swift SyncEngine Skeleton + RNBridge

**Must complete before T5.3a-f. Can run in parallel with Track A after T5.0.**

**Files:**
- Create: `ios/SyncEngine/SyncEngineManager.swift`, `RNBridge.swift`, `RNBridge.m`
- Modify: `ios/SyncFlow/Info.plist`, `ios/SyncFlow/AppDelegate.swift`

- [ ] **Step 1: Create SyncEngineManager facade**

Singleton that holds references to all services. Stub methods that delegate to services (services created in subsequent tasks).

```swift
class SyncEngineManager {
    static let shared = SyncEngineManager()
    // Services will be initialized here in T5.3 tasks
    func startDiscovery() { /* stub */ }
    func stopDiscovery() { /* stub */ }
    func pairDevice(deviceId: String, host: String, port: Int, code: String) async throws { /* stub */ }
    // ... all TurboModule methods delegate here
}
```

- [ ] **Step 2: Create RNBridge.swift**

TurboModule implementation wrapping SyncEngineManager. Each method from the spec interface becomes a Swift method that calls the manager.

- [ ] **Step 3: Create RNBridge.m**

ObjC bridge macro for TurboModule registration:
```objc
#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(NativeSyncEngine, NSObject)
// Method exports
@end
```

- [ ] **Step 4: Update Info.plist**

Add all capabilities from spec Section 9.5:
- `NSLocalNetworkUsageDescription`
- `NSBonjourServices` = `["_syncflow._tcp"]`
- `NSPhotoLibraryUsageDescription`
- `UIBackgroundModes` = `["processing"]`
- `BGTaskSchedulerPermittedIdentifiers` = `["com.syncflow.sync.continued", "com.syncflow.sync.maintenance"]`

- [ ] **Step 5: Update AppDelegate**

Register BGTask identifiers on launch.

- [ ] **Step 6: Verify build**

```bash
cd apps/mobile && npx react-native run-ios
```

- [ ] **Step 7: Commit**

```
feat(mobile): Swift SyncEngine skeleton + RNBridge + Info.plist capabilities
```

---

### Task 5.3a 🔀 DiscoveryService + BindingService

**Can run in parallel with 5.3b-f after T5.2.**

- [ ] **Step 1: Create DiscoveryService.swift**

Uses `NWBrowser` (Network.framework) to browse `_syncflow._tcp`:
- Start/stop browsing
- Parse TXT records into DiscoveredDevice model
- Emit devices list to RNBridge via delegate/callback
- De-duplicate by deviceId
- Sort: bound > online

- [ ] **Step 2: Create BindingService.swift**

- Store/read pairingToken from Keychain
- Store binding info in SQLite (via UploadStore)
- Generate clientId (UUID) on first launch, persist in Keychain
- Methods: `pair(deviceId, host, port, code)`, `unbind()`, `getBindingState()`

- [ ] **Step 3: Commit**

```
feat(mobile): DiscoveryService (Bonjour) + BindingService (Keychain)
```

---

### Task 5.3b 🔀 PhotoScanner + AssetExportService

- [ ] **Step 1: Create PhotoScanner.swift**

Uses PhotoKit:
- Request `PHAccessLevel.readWrite`
- Scan all photos/videos (`PHAsset.fetchAssets`)
- Compute fileKey (SHA256 formula from spec 8.10)
- Check against local UploadStore for already-uploaded items
- Output static queue of new/failed items

- [ ] **Step 2: Create AssetExportService.swift**

- Export single PHAsset to temp directory via `PHAssetResourceManager`
- Support iCloud downloads (`isNetworkAccessAllowed = true`)
- Return: temp path, originalFilename, size, mimeType, createdAt
- Clean up temp file after upload or on error

- [ ] **Step 3: Commit**

```
feat(mobile): PhotoScanner (incremental) + AssetExportService
```

---

### Task 5.3c 🔀 TcpTransport (LMUP Client)

- [ ] **Step 1: Create TcpTransport.swift**

LMUP/2 client-side protocol implementation:
- TCP connect via `NWConnection` (Network.framework)
- Frame encode/decode (12-byte header, big-endian)
- Send: HELLO_REQ, AUTH_REQ (HMAC), PAIR_REQ, SYNC_BEGIN_REQ, FILE_INIT_REQ, FILE_DATA, FILE_END_REQ, SYNC_END_REQ, PING
- Receive: HELLO_RES, PAIR_RES, SYNC_BEGIN_RES, FILE_INIT_RES, FILE_ACK, FILE_END_RES, SYNC_END_RES, PONG, ERROR
- FILE_DATA: binary body construction (fileKeyLen + fileKey + offset + data)
- 8 MiB chunk reading from file
- Heartbeat: send PING every 15s if idle

- [ ] **Step 2: Commit**

```
feat(mobile): TcpTransport — LMUP/2 client with frame encode/decode
```

---

### Task 5.3d 🔀 UploadQueueManager + SessionService

- [ ] **Step 1: Create UploadQueueManager.swift**

Serial upload orchestrator:
- Maintains ordered queue from PhotoScanner output
- One file at a time
- For each file: export → FILE_INIT → FILE_DATA chunks → FILE_END
- Handle responses: UPLOAD, RESUME (seek offset), SKIP (next), REJECT (pause)
- Track progress, emit events
- On error: mark failed, continue to next

- [ ] **Step 2: Create SessionService.swift**

- Generate sessionId (UUID)
- Track current sync session state (state machine from spec 9.2)
- Persist session to SQLite
- Resume: recover session + queue position on reconnect

- [ ] **Step 3: Commit**

```
feat(mobile): UploadQueueManager (serial) + SessionService
```

---

### Task 5.3e 🔀 UploadStore + HistoryLedgerStore

- [ ] **Step 1: Create UploadStore.swift**

SQLite using GRDB.swift (or raw SQLite3 C API):
- Tables from spec Section 8.12: `binding`, `upload_items`, `sync_sessions`, `daily_ledgers`
- CRUD: insert/query upload items, update status, check completed fileKeys
- `modified_at TEXT NOT NULL DEFAULT ''` (spec requirement for UNIQUE constraint)

- [ ] **Step 2: Create HistoryLedgerStore.swift**

- Aggregate by date + device
- Accumulate ACTIVE_TRANSMISSION_TIME
- Query for getHistoryDays with cursor pagination

- [ ] **Step 3: Add GRDB.swift dependency**

In Podfile or SPM.

- [ ] **Step 4: Commit**

```
feat(mobile): UploadStore + HistoryLedgerStore (SQLite)
```

---

### Task 5.3f 🔀 BackgroundExecutionService

- [ ] **Step 1: Create BackgroundExecutionService.swift**

Three-layer background strategy from spec Section 9:
1. `UIApplication.beginBackgroundTask` — bridge on app state change
2. `BGContinuedProcessingTask` (id: `com.syncflow.sync.continued`) — long sync
3. `BGProcessingTaskRequest` (id: `com.syncflow.sync.maintenance`) — periodic scan

```swift
class BackgroundExecutionService {
    func registerBackgroundTasks() { /* BGTaskScheduler.shared.register */ }
    func submitContinuedTask() { /* Submit when foreground sync starts */ }
    func submitMaintenanceTask() { /* Submit when sync ends or continued expires */ }
    func beginTransitionTask() -> UIBackgroundTaskIdentifier { /* Bridge task */ }
}
```

- [ ] **Step 2: Commit**

```
feat(mobile): BackgroundExecutionService (BGContinuedProcessingTask)
```

---

## Task 5.4 🔁 Wire Everything + Integration

**Depends on: all Track A + Track B complete.**

- [ ] **Step 1: Wire SyncEngineManager to all services**

Initialize all services in SyncEngineManager.init(). Connect delegates/callbacks. Wire event emission to RNBridge.

- [ ] **Step 2: Wire screens to native module**

Update screens to call `useSyncEngine()` methods instead of mock data. Subscribe to events for real-time updates.

- [ ] **Step 3: Build and run on simulator**

```bash
cd apps/mobile && npx react-native run-ios
```

- [ ] **Step 4: Manual integration test**

With Mac sidecar running:
1. App launches → DeviceDiscovery shows Mac
2. Tap Mac → CodeVerify → enter code → success
3. SyncStatus shows (empty queue if no photos)
4. History page shows (empty if first sync)
5. Settings shows bound device

- [ ] **Step 5: Dispatch code reviewer**

Review scope: `apps/mobile/`. Criteria:
- Swift memory management (no retain cycles)
- Thread safety (main thread for UI, background for I/O)
- Keychain security (no plaintext tokens)
- PhotoKit permission handling
- Background task lifecycle correctness
- TurboModule bridge completeness

- [ ] **Step 6: Commit**

```
chore: Phase 5 complete — Mobile app with RN + Swift SyncEngine
```

---

## Verification Summary

### Phase 5 Gate

```bash
# RN app builds
cd apps/mobile && npx react-native run-ios

# All 5 screens navigate correctly
# Native module bridge compiles
# Bonjour discovers running sidecar
# Connection code pairing succeeds
# (Full sync test requires real photos — deferred to QA)

# TS tests still pass
cd /Volumes/workspace/work/sync-flow && pnpm turbo test

# Go tests still pass
cd services/sidecar-go && go test ./...
```
