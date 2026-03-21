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
    var browserState: String = "not_started"

    func startBrowsing() {
        NSLog("[DiscoveryService] startBrowsing called")
        // Use _syncflow._tcp without trailing dot — Apple's API adds it automatically
        let descriptor = NWBrowser.Descriptor.bonjour(type: "_syncflow._tcp", domain: nil)
        let params = NWParameters()
        params.includePeerToPeer = true
        browser = NWBrowser(for: descriptor, using: params)

        browser?.browseResultsChangedHandler = { [weak self] results, changes in
            NSLog("[DiscoveryService] results changed: \(results.count) results, \(changes.count) changes")
            self?.handleResults(results)
        }

        browser?.stateUpdateHandler = { [weak self] state in
            NSLog("[DiscoveryService] state: \(state)")
            self?.browserState = String(describing: state)
            if case .failed(let error) = state {
                NSLog("[DiscoveryService] FAILED: \(error)")
                self?.browserState = "failed: \(error)"
            }
        }

        browser?.start(queue: queue)
        NSLog("[DiscoveryService] browser started")
    }

    func stopBrowsing() {
        browser?.cancel()
        browser = nil
        devices.removeAll()
    }

    private func handleResults(_ results: Set<NWBrowser.Result>) {
        var updated: [String: DiscoveredDevice] = [:]

        for result in results {
            NSLog("[DiscoveryService] result: endpoint=\(result.endpoint) metadata=\(result.metadata)")

            if case .service(let name, let type, let domain, _) = result.endpoint {
                NSLog("[DiscoveryService] found service: name=\(name) type=\(type) domain=\(domain)")

                switch result.metadata {
                case .bonjour(let txtRecord):
                    NSLog("[DiscoveryService] has TXT record")
                    let device = parseTXTRecord(serviceName: name, txtRecord: txtRecord)
                    if let device {
                        updated[device.deviceId] = device
                        NSLog("[DiscoveryService] parsed device: \(device.name) id=\(device.deviceId)")
                    } else {
                        // Service found but no valid TXT — create device from service name
                        let fallbackDevice = DiscoveredDevice(
                            deviceId: name,
                            name: name,
                            type: "mac",
                            ip: "",
                            port: 39393,
                            protoVersion: 2,
                            authMode: "code",
                            shareEnabled: false,
                            shareName: nil
                        )
                        updated[name] = fallbackDevice
                        NSLog("[DiscoveryService] created fallback device from service name")
                    }
                case .none:
                    NSLog("[DiscoveryService] no metadata, creating fallback device")
                    let fallbackDevice = DiscoveredDevice(
                        deviceId: name,
                        name: name,
                        type: "mac",
                        ip: "",
                        port: 39393,
                        protoVersion: 2,
                        authMode: "code",
                        shareEnabled: false,
                        shareName: nil
                    )
                    updated[name] = fallbackDevice
                default:
                    NSLog("[DiscoveryService] unexpected metadata type")
                }
            }
        }

        devices = updated
        NSLog("[DiscoveryService] emitting \(updated.count) devices")
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
        return record[key]
    }
}
