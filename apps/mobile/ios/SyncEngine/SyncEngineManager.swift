import Foundation
import Photos
import UIKit

@objc
class SyncEngineManager: NSObject, DiscoveryServiceDelegate {
    static let shared = SyncEngineManager()

    let discoveryService = DiscoveryService()
    let bindingService = BindingService()
    let sessionService = SessionService()
    let backgroundService = BackgroundExecutionService()
    let photoScanner = PhotoScanner()
    let exportService = AssetExportService()
    let uploadQueue = UploadQueueManager()
    let transport = TcpTransport()
    private var uploadStore: UploadStore?
    private var historyStore: HistoryLedgerStore?

    private override init() {
        super.init()
        do {
            uploadStore = try UploadStore()
            historyStore = HistoryLedgerStore(store: uploadStore!)
        } catch {
            NSLog("[SyncEngine] Failed to init stores: \(error)")
        }
        uploadQueue.exportService = exportService
        discoveryService.delegate = self

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    // MARK: - App State Transitions

    @objc private func appDidEnterBackground() {
        NSLog("[SyncEngine] app entered background")
        if sessionService.state == .syncingForeground {
            sessionService.transitionTo(.syncingBackground)
            let taskId = backgroundService.beginTransitionTask()
            backgroundService.submitContinuedTask()
            // End transition task after a delay to allow BGTask scheduling
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                self.backgroundService.endTransitionTask(taskId)
            }
        }
    }

    @objc private func appWillEnterForeground() {
        NSLog("[SyncEngine] app entering foreground")
        if sessionService.state == .syncingBackground {
            sessionService.transitionTo(.syncingForeground)
        }
    }

    // MARK: - Sync

    /// Start or resume a sync session. Currently a stub — full pipeline wired in a follow-up task.
    func startSync() {
        NSLog("[SyncEngine] startSync (stub)")
    }

    // MARK: - DiscoveryServiceDelegate

    func discoveryDidUpdate(devices: [DiscoveredDevice]) {
        NSLog("[SyncEngine] discoveryDidUpdate called with \(devices.count) devices")
        let mapped: [[String: Any]] = devices.map { device in
            [
                "deviceId": device.deviceId,
                "name": device.name,
                "ip": device.ip,
                "type": device.type,
                "port": Int(device.port),
                "protoVersion": device.protoVersion,
                "authMode": device.authMode,
                "shareEnabled": device.shareEnabled,
                "shareName": device.shareName ?? NSNull(),
            ]
        }
        if let bridge = NativeSyncEngineModule.shared {
            NSLog("[SyncEngine] emitting \(mapped.count) devices to RN")
            bridge.emitDiscoveredDevices(mapped)
        } else {
            NSLog("[SyncEngine] WARNING: NativeSyncEngineModule.shared is nil, cannot emit")
        }
    }

    // MARK: - Discovery

    func startDiscovery() {
        NSLog("[SyncEngine] startDiscovery - delegate is \(discoveryService.delegate == nil ? "nil" : "set")")
        discoveryService.startBrowsing()
    }

    func stopDiscovery() {
        NSLog("[SyncEngine] stopDiscovery")
        discoveryService.stopBrowsing()
    }

    // MARK: - Permissions

    func requestPhotoPermission() async -> String {
        let status = await photoScanner.requestPermission()
        switch status {
        case .authorized:
            return "granted"
        case .limited:
            return "limited"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }

    // MARK: - Pairing

    func pairDevice(deviceId: String, host: String, port: Int, connectionCode: String) async throws {
        // Stub: full LMUP handshake will be wired in a follow-up task.
        // For now, log and return success so the UI flow works end-to-end.
        NSLog("[SyncEngine] pairDevice \(deviceId) at \(host):\(port) code=\(connectionCode) (stub)")
    }

    func disconnectAndUnbind() async throws {
        NSLog("[SyncEngine] disconnectAndUnbind")
        bindingService.clearPairingToken()
        try uploadStore?.clearBinding()
        transport.disconnect()
        sessionService.endSession()
    }

    // MARK: - State Queries

    func getBindingState() async -> [String: Any]? {
        guard let binding = uploadStore?.getBinding() else {
            return nil
        }
        return [
            "deviceId": binding.deviceId,
            "deviceName": binding.deviceName,
            "deviceAlias": binding.deviceAlias ?? NSNull(),
            "deviceType": binding.deviceType,
            "host": binding.host,
            "port": binding.port,
            "shareName": binding.shareName ?? NSNull(),
            "lastBoundAt": binding.lastBoundAt,
        ]
    }

    func getSyncOverview() async -> [String: Any] {
        let state = sessionService.state.rawValue
        let sessionId = sessionService.currentSessionId ?? ""
        let completedCount = uploadQueue.completedCount
        let totalCount = uploadQueue.totalCount

        return [
            "sessionId": sessionId,
            "state": state,
            "completedCount": completedCount,
            "totalCount": totalCount,
            "currentSpeedMbps": 0,
            "transferredBytes": 0,
            "totalBytes": 0,
            "progressPercent": totalCount > 0 ? (completedCount * 100) / totalCount : 0,
            "uploadState": state,
        ]
    }

    func getReadOnlyQueue() async -> [[String: Any]] {
        // Return pending items from the upload store if available
        guard let store = uploadStore else { return [] }
        let pending = store.getPendingUploadItems()
        return pending.map { item in
            [
                "id": item.id ?? 0,
                "assetLocalId": item.assetLocalId,
                "fileKey": item.fileKey ?? "",
                "originalFilename": item.originalFilename ?? "",
                "mediaType": item.mediaType,
                "fileSize": item.fileSize ?? 0,
                "status": item.status,
                "ackedOffset": item.ackedOffset,
            ] as [String: Any]
        }
    }

    func getHistoryDays(cursor: String?) async -> [String: Any] {
        guard let historyStore else {
            return ["items": [], "nextCursor": NSNull()]
        }
        let result = historyStore.getDailyLedgers(cursor: cursor)
        let items: [[String: Any]] = result.items.map { ledger in
            [
                "ledgerDate": ledger.ledgerDate,
                "deviceId": ledger.deviceId,
                "deviceName": ledger.deviceNameSnapshot,
                "deviceIp": ledger.deviceIpSnapshot,
                "fileCount": ledger.fileCount,
                "totalBytes": ledger.totalBytes,
                "transmissionMs": ledger.activeTransmissionMs,
            ]
        }
        return [
            "items": items,
            "nextCursor": result.nextCursor ?? NSNull(),
        ]
    }

    // MARK: - Settings

    func renameBoundDeviceAlias(alias: String) async throws {
        NSLog("[SyncEngine] renameBoundDeviceAlias \(alias)")
        guard var binding = uploadStore?.getBinding() else {
            throw SyncEngineError.pairingError("No active binding to rename")
        }
        binding.deviceAlias = alias
        try uploadStore?.saveBinding(binding)
    }
}
