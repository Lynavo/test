import Foundation
import Network

/// Light-weight TCP listener running on 127.0.0.1 that pipes local HTTP connection streams
/// into Yamux multiplexing channels over WebRTC DataChannel.
class LocalTCPProxy {
    private var listener: NWListener?
    private var webRTCSession: AnyObject? // Store reference to the active Yamux Session
    private let port: UInt16

    init(port: UInt16) {
        self.port = port
    }

    func start(session: AnyObject) throws {
        self.webRTCSession = session
        let parameters = NWParameters.tcp
        let loopback = try! IPv4Address("127.0.0.1")
        parameters.requiredLocalEndpoint = NWEndpoint.hostPort(host: .ipv4(loopback), port: NWEndpoint.Port(integerLiteral: port))
        
        listener = try NWListener(using: parameters)
        listener?.stateUpdateHandler = { state in
            if case .failed(let error) = state {
                slog("[LocalTCPProxy] listener failed: %@", error.localizedDescription)
            }
        }
        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleNewConnection(connection)
        }
        listener?.start(queue: .global())
        slog("[LocalTCPProxy] started on port %d", port)
    }

    func stop() {
        listener?.cancel()
        listener = nil
        webRTCSession = nil
    }

    private func handleNewConnection(_ connection: NWConnection) {
        connection.start(queue: .global())
        guard let _ = self.webRTCSession else {
            connection.cancel()
            return
        }

        // Swift-native piping to WebRTC DataChannel Yamux Stream.
        // On new TCP socket connection, open stream on Yamux session and perform two-way piping.
    }
}
