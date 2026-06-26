import Foundation

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() {
        fputs("SharedFilesHTTPStatusErrorTests failed: \(message)\n", stderr)
        exit(1)
    }
}

func makeHTTPStatusError(
    statusCode: Int,
    path: String,
    responseBody: String?
) -> SharedFileHTTPStatusError {
    SharedFileHTTPStatusError(
        statusCode: statusCode,
        path: path,
        responseBody: responseBody
    )
}

let desktopLoggedOutError = makeHTTPStatusError(
    statusCode: 401,
    path: "/personal/list",
    responseBody: #"{"error":"desktop account identity is unavailable"}"#
)

expect(
    desktopLoggedOutError.errorDescription == "Sidecar returned HTTP 401 for /personal/list: desktop account identity is unavailable",
    "sidecar JSON error body must be normalized so JS can classify desktop logout"
)

let remoteAccessDisabledError = makeHTTPStatusError(
    statusCode: 403,
    path: "/personal/list",
    responseBody: #"{"error":"remote access is disabled"}"#
)

expect(
    remoteAccessDisabledError.errorDescription == "Sidecar returned HTTP 403 for /personal/list: remote access is disabled",
    "sidecar JSON error body must be normalized so JS can classify disabled remote access"
)

let emptyBodyError = makeHTTPStatusError(
    statusCode: 403,
    path: "/personal/list",
    responseBody: "   "
)

expect(
    emptyBodyError.errorDescription == "Sidecar returned HTTP 403 for /personal/list",
    "empty response bodies must fall back to the generic HTTP status message"
)
