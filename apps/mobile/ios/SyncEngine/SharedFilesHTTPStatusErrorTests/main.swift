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
    responseBody: "desktop account identity is unavailable"
)

expect(
    desktopLoggedOutError.errorDescription?.contains("desktop account identity is unavailable") == true,
    "sidecar response body must be preserved so JS can classify desktop logout"
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
