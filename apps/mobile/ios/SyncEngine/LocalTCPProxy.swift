import Foundation
import SyncFlowMobileTunnel

/// Swift wrapper that delegates P2P loopback proxying to the Go mobile library (SyncFlowMobileTunnel).
class LocalTCPProxy {
    private var activePort: Int?
    private var diagnosticsDrainTimer: DispatchSourceTimer?
    private let diagnosticsDrainQueue = DispatchQueue(label: "com.syncflow.mobileTunnelDiagnostics", qos: .utility)

    private func flushMobileTunnelDiagnostics(reason: String) {
        let snapshot = MobiletunnelTakeDiagnosticsLog()
        let lines = snapshot
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty else { return }

        syncDiagnosticsLog("MobileTunnel", "diagnostics drain reason=\(reason) lineCount=\(lines.count)")
        for line in lines {
            syncDiagnosticsLog("MobileTunnel", line)
        }
    }

    private func startMobileTunnelDiagnosticsDrain() {
        stopMobileTunnelDiagnosticsDrain()
        let timer = DispatchSource.makeTimerSource(queue: diagnosticsDrainQueue)
        timer.schedule(deadline: .now() + 5, repeating: 5)
        timer.setEventHandler { [weak self] in
            self?.flushMobileTunnelDiagnostics(reason: "periodic")
        }
        diagnosticsDrainTimer = timer
        timer.resume()
    }

    private func stopMobileTunnelDiagnosticsDrain() {
        diagnosticsDrainTimer?.cancel()
        diagnosticsDrainTimer = nil
    }

    func start(
        signalingURL: String,
        clientID: String,
        targetClientID: String,
        token: String,
        pairingToken: String,
        iceServersJSON: String
    ) -> Int {
        slog("[LocalTCPProxy] Starting P2P tunnel connection with signaling: %@", signalingURL)
        syncDiagnosticsLog("LocalTCPProxy", "starting P2P tunnel signaling=\(signalingURL) target=\(targetClientID)")
        stopMobileTunnelDiagnosticsDrain()
        flushMobileTunnelDiagnostics(reason: "before_start")
        let port = MobiletunnelStartTunnel(signalingURL, clientID, targetClientID, token, pairingToken, iceServersJSON)
        flushMobileTunnelDiagnostics(reason: "after_start")
        if port > 0 {
            activePort = port
            startMobileTunnelDiagnosticsDrain()
            slog("[LocalTCPProxy] P2P tunnel started successfully on port %ld", port)
            syncDiagnosticsLog("LocalTCPProxy", "P2P tunnel active port=\(port)")
        } else {
            activePort = nil
            stopMobileTunnelDiagnosticsDrain()
            slog("[LocalTCPProxy] Failed to start P2P tunnel, return code: %ld", port)
            syncDiagnosticsLog("LocalTCPProxy", "P2P tunnel failed returnCode=\(port)")
        }
        return port
    }

    func stop() {
        guard activePort != nil else { return }
        slog("[LocalTCPProxy] Stopping P2P tunnel")
        syncDiagnosticsLog("LocalTCPProxy", "stopping P2P tunnel")
        stopMobileTunnelDiagnosticsDrain()
        MobiletunnelStopTunnel()
        flushMobileTunnelDiagnostics(reason: "after_stop")
        activePort = nil
    }

    func getActivePort() -> Int? {
        return activePort
    }

    func currentSelectedICERoute() -> String {
        return MobiletunnelCurrentSelectedICERoute()
    }
}
