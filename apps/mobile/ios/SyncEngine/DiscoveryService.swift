import Foundation
import Network

protocol DiscoveryServiceDelegate: AnyObject {
    func discoveryDidUpdate(devices: [DiscoveredDevice])
}

struct DiscoveredDevice {
    let deviceId: String
    let name: String
    let type: String  // "mac"
    let ip: String
    let port: UInt16
    let protoVersion: Int
    let authMode: String  // "code"
    let shareEnabled: Bool
    let shareName: String?
}

class DiscoveryService {
    private var browser: NWBrowser?
    private let queue = DispatchQueue(label: "com.syncflow.discovery")
    private var devices: [String: DiscoveredDevice] = [:]  // keyed by deviceId
    weak var delegate: DiscoveryServiceDelegate?

    func startBrowsing() {
        let params = NWParameters()
        params.includePeerToPeer = true
        browser = NWBrowser(for: .bonjourWithTXTRecord(type: "_syncflow._tcp", domain: nil), using: params)

        browser?.browseResultsChangedHandler = { [weak self] results, _ in
            self?.handleResults(results)
        }

        browser?.stateUpdateHandler = { state in
            print("[DiscoveryService] state: \(state)")
        }

        browser?.start(queue: queue)
    }

    func stopBrowsing() {
        browser?.cancel()
        browser = nil
        devices.removeAll()
    }

    private func handleResults(_ results: Set<NWBrowser.Result>) {
        var updated: [String: DiscoveredDevice] = [:]

        for result in results {
            if case .service(let name, _, _, _) = result.endpoint {
                if case .bonjour(let txtRecord) = result.metadata {
                    let device = parseTXTRecord(serviceName: name, txtRecord: txtRecord)
                    if let device {
                        updated[device.deviceId] = device
                    }
                }
            }
        }

        devices = updated
        delegate?.discoveryDidUpdate(devices: Array(updated.values))
    }

    private func parseTXTRecord(serviceName: String, txtRecord: NWTXTRecord) -> DiscoveredDevice? {
        guard let id = txtString(from: txtRecord, key: "id"),
              let deviceName = txtString(from: txtRecord, key: "name"),
              let type = txtString(from: txtRecord, key: "type") else {
            return nil
        }

        let proto = Int(txtString(from: txtRecord, key: "proto") ?? "2") ?? 2
        let auth = txtString(from: txtRecord, key: "auth") ?? "code"
        let share = txtString(from: txtRecord, key: "share") == "1"
        let shareName = txtString(from: txtRecord, key: "shareName")

        // IP resolution happens when connecting, not during browsing.
        // Return empty IP here — will be resolved via NWConnection endpoint.
        return DiscoveredDevice(
            deviceId: id,
            name: deviceName,
            type: type,
            ip: "",
            port: 39393,
            protoVersion: proto,
            authMode: auth,
            shareEnabled: share,
            shareName: shareName
        )
    }

    /// Extract a UTF-8 string value from an NWTXTRecord entry.
    private func txtString(from record: NWTXTRecord, key: String) -> String? {
        guard let entry = record[key] else { return nil }
        switch entry {
        case .string(let value):
            return value
        case .rawBytes(let data):
            return String(data: data, encoding: .utf8)
        @unknown default:
            return nil
        }
    }
}
