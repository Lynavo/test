import Foundation

struct PublicWakeTarget: Codable, Equatable {
    let kind: String
    let host: String
    let port: Int
    let enabled: Bool
    let updatedAt: String
}

struct WakeCapability: Codable, Equatable {
    let supported: Bool
    let targets: [WakeTarget]
    let publicTarget: PublicWakeTarget?
    let updatedAt: String

    var hasUsableTargets: Bool {
        supported && !WakeOnLanService.validTargets(targets).isEmpty
    }

    func toPayload() -> [String: Any] {
        var payload: [String: Any] = [
            "supported": supported,
            "targets": targets.map { target in
                [
                    "interfaceName": target.interfaceName,
                    "macAddress": target.macAddress,
                    "ipv4Address": target.ipv4Address,
                    "broadcastAddress": target.broadcastAddress,
                    "ports": target.ports,
                ]
            },
            "updatedAt": updatedAt,
        ]
        if let publicTarget = publicTarget {
            payload["publicTarget"] = [
                "kind": publicTarget.kind,
                "host": publicTarget.host,
                "port": publicTarget.port,
                "enabled": publicTarget.enabled,
                "updatedAt": publicTarget.updatedAt,
            ]
        } else {
            payload["publicTarget"] = NSNull()
        }
        return payload
    }

    static func fromJSONValue(_ value: Any?) -> WakeCapability? {
        guard let object = value as? [String: Any] else { return nil }
        let supported = (object["supported"] as? Bool) ?? false
        let updatedAt = (object["updatedAt"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let rawTargets = object["targets"] as? [[String: Any]] ?? []
        let targets = rawTargets.compactMap { raw -> WakeTarget? in
            let ports: [Int]?
            if let rawPorts = raw["ports"] as? [Int] {
                ports = rawPorts
            } else if let rawPorts = raw["ports"] as? [NSNumber] {
                ports = rawPorts.map(\.intValue)
            } else {
                ports = nil
            }
            guard let ports else {
                return nil
            }
            return WakeTarget(
                interfaceName: (raw["interfaceName"] as? String) ?? "",
                macAddress: (raw["macAddress"] as? String) ?? "",
                ipv4Address: (raw["ipv4Address"] as? String) ?? "",
                broadcastAddress: (raw["broadcastAddress"] as? String) ?? "",
                ports: ports
            )
        }

        var publicTarget: PublicWakeTarget? = nil
        if let publicRaw = object["publicTarget"] as? [String: Any] {
            let kind = (publicRaw["kind"] as? String) ?? "router_wan_udp"
            let host = (publicRaw["host"] as? String) ?? ""
            let port = (publicRaw["port"] as? Int) ?? (publicRaw["port"] as? NSNumber)?.intValue ?? 0
            let enabled = (publicRaw["enabled"] as? Bool) ?? false
            let pUpdatedAt = (publicRaw["updatedAt"] as? String) ?? ""
            publicTarget = PublicWakeTarget(kind: kind, host: host, port: port, enabled: enabled, updatedAt: pUpdatedAt)
        }

        return WakeCapability(
            supported: supported,
            targets: targets,
            publicTarget: publicTarget,
            updatedAt: updatedAt?.isEmpty == false ? updatedAt! : ISO8601DateFormatter().string(from: Date())
        )
    }

    static func decodeJSONString(_ raw: String?) -> WakeCapability? {
        guard let raw,
              let data = raw.data(using: .utf8)
        else {
            return nil
        }
        return try? JSONDecoder().decode(WakeCapability.self, from: data)
    }

    func encodeJSONString() -> String? {
        guard let data = try? JSONEncoder().encode(self) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func merge(newWake: WakeCapability?, existingWake: WakeCapability?) -> WakeCapability? {
        guard let newWake else {
            return existingWake
        }
        return WakeCapability(
            supported: newWake.supported,
            targets: newWake.targets,
            publicTarget: existingWake?.publicTarget,
            updatedAt: newWake.updatedAt
        )
    }
}
