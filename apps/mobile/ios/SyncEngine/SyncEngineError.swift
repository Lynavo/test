import Foundation

enum SyncEngineError: Error, LocalizedError {
    case databaseError(String)
    case networkError(String)
    case pairingError(String)
    case permissionError(String)

    var errorDescription: String? {
        switch self {
        case .databaseError(let msg): return "Database error: \(msg)"
        case .networkError(let msg): return "Network error: \(msg)"
        case .pairingError(let msg): return "Pairing rejected: \(msg)"
        case .permissionError(let msg): return "Permission error: \(msg)"
        }
    }
}
