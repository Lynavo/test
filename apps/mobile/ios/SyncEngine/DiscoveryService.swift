import Foundation
import Network

protocol DiscoveryServiceDelegate: AnyObject {
    func discoveryDidUpdate(devices: [DiscoveredDevice])
}

struct DiscoveredDevice {
    let deviceId: String
    let name: String
    let type: String
    let ip: String
    let port: UInt16
    let protoVersion: Int
    let authMode: String
    let shareEnabled: Bool
    let shareName: String?
    let endpoint: NWEndpoint?
}

class DiscoveryService {
    private var browser: NWBrowser?
    private let queue = DispatchQueue(label: "com.syncflow.discovery")
    private var devices: [String: DiscoveredDevice] = [:]
    weak var delegate: DiscoveryServiceDelegate?
    var browserState: String = "not_started"

    func startBrowsing() {
        NSLog("[DiscoveryService] startBrowsing called")
        let descriptor = NWBrowser.Descriptor.bonjourWithTXTRecord(type: "_syncflow._tcp", domain: nil)
        let params = NWParameters()
        params.includePeerToPeer = true
        browser = NWBrowser(for: descriptor, using: params)

        browser?.browseResultsChangedHandler = { [weak self] results, _ in
            NSLog("[DiscoveryService] results changed: \(results.count) results")
            self?.handleResults(results)
        }

        browser?.stateUpdateHandler = { [weak self] state in
            NSLog("[DiscoveryService] state: \(state)")
            self?.browserState = String(describing: state)
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
                var device: DiscoveredDevice?

                if case .bonjour(let txtRecord) = result.metadata {
                    // Try multiple approaches to read TXT record
                    var txtDict: [String: String] = [:]

                    // Approach 1: .dictionary property
                    let rawDict = txtRecord.dictionary
                    for (k, v) in rawDict {
                        txtDict[k] = v
                    }

                    // Approach 2: getEntry(for:) API if dictionary was empty
                    if txtDict.isEmpty {
                        let keys = ["id", "name", "type", "proto", "auth", "share", "shareName"]
                        for key in keys {
                            if let entry = txtRecord.getEntry(for: key) {
                                switch entry {
                                case .string(let s):
                                    txtDict[key] = s
                                case .empty:
                                    txtDict[key] = ""
                                @unknown default:
                                    // Try to extract string from unknown entry types
                                    txtDict[key] = "\(entry)"
                                }
                            }
                        }
                    }

                    if let id = txtDict["id"], !id.isEmpty {
                        device = DiscoveredDevice(
                            deviceId: id,
                            name: txtDict["name"] ?? name,
                            type: txtDict["type"] ?? "mac",
                            ip: "",
                            port: 39393,
                            protoVersion: Int(txtDict["proto"] ?? "2") ?? 2,
                            authMode: txtDict["auth"] ?? "code",
                            shareEnabled: txtDict["share"] == "1",
                            shareName: txtDict["shareName"],
                            endpoint: result.endpoint
                        )
                    }
                }

                // Fallback: use service name as device ID, include debug metadata type
                if device == nil {
                    device = DiscoveredDevice(
                        deviceId: name, name: name, type: "mac", ip: "",
                        port: 39393, protoVersion: 2, authMode: "code",
                        shareEnabled: false, shareName: nil, endpoint: result.endpoint
                    )
                }

                if let d = device {
                    updated[d.deviceId] = d
                }
            }
        }

        devices = updated
        delegate?.discoveryDidUpdate(devices: Array(updated.values))
    }
}
