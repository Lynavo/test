# Team Shared And Personal Directories Design

## Background

Vivi Drop currently treats the desktop `shared/` directory as the only browseable directory for mobile clients. The intended product model is different:

- Team shared directory: visible to all connected local-network users/devices.
- Personal directory: visible only when the mobile and desktop are signed in to the same account.
- Receive directory: part of the personal directory, because received mobile uploads are private to the account owner.

The current implementation already fits the team-shared meaning for `shared/`: sidecar exposes `/shared/*`, desktop displays the shared path, and mobile browses/downloads shared files through direct LAN or P2P routes. It does not yet have a personal directory or an account-authenticated sidecar file API.

## Goals

1. Preserve the existing `shared/` directory as the team shared directory.
2. Add a personal directory that is account-scoped.
3. Move the receive directory under the personal directory in the effective directory model.
4. Prevent personal directory access unless mobile and desktop belong to the same server account.
5. Keep existing upload queue semantics unchanged: read-only queue, automatic incremental sync, and one-file-at-a-time upload per phone.
6. Keep renderer access mediated through preload/main/sidecar; renderer must not touch sidecar, filesystem, or SQLite directly.

## Non-Goals

- Do not add manual file selection for uploads.
- Do not add user-controlled queue deletion, reordering, or skipping.
- Do not make team shared files account-private.
- Do not implement cloud storage or server-hosted file transfer for personal files.
- Do not require remote server build or deployment in this task.

## Directory Model

For a root path `<root>`, the effective layout becomes:

```text
<root>/
  shared/              # Team shared directory
  personal/            # Personal directory
    received/          # Receive directory
  staging/             # Runtime staging directory
```

`shared/` remains the path behind the existing shared-file behavior. It is intentionally not account-gated by sidecar because its product meaning is team/local-network sharing.

`personal/` is a new private browseable root. `personal/received/` is the receive root used by uploads, dashboard history, device details, and file existence checks.

## Migration Strategy

For new installs or when the user changes the root path:

- `receivePath` is derived as `<root>/personal/received`.
- `personalPath` is derived as `<root>/personal`.
- `sharedPath` stays `<root>/shared`.

For existing installs currently using `<root>/received`:

1. Detect whether `receivePath` is exactly `<root>/received`.
2. If no transfer is active, create `<root>/personal/received`.
3. Move existing received files into `<root>/personal/received` when the target does not already contain conflicting paths.
4. Update persisted `receive_root` to the new path.
5. If a transfer is active, defer migration and keep the current path until a safe retry.

If a user has explicitly configured a custom receive path that is not root-derived, preserve it until the user changes the root path. The settings DTO still exposes `personalPath`, but `receivePath` may remain outside it for that legacy custom case. This avoids silent data moves for custom storage.

## Contracts

Add fields and types in `@syncflow/contracts`:

- `SettingsDTO.personalPath: string`
- Directory scope type: `DirectoryScope = 'team' | 'personal'`
- Reuse the file listing shape where possible:
  - `DirectoryFileDTO` or compatible shared/personal file DTO
  - `DirectoryListingDTO` with `scope`, `path`, `files`, `totalCount`

Compatibility rule:

- Existing `SharedFileDTO` and `SharedDirectoryDTO` can remain as aliases or retained exports for current `/shared/*` consumers.
- New mobile/desktop code should use scoped directory DTO names when it needs to distinguish team vs personal.

## Client Sidecar API

Existing team shared routes remain:

- `GET /shared/list`
- `GET /shared/list/{path...}`
- `GET /shared/thumbnail/{path...}`
- `GET /shared/download/{path...}`
- `GET /shared/stream/{path...}`

Add account-gated personal routes:

- `GET /personal/list`
- `GET /personal/list/{path...}`
- `GET /personal/thumbnail/{path...}`
- `GET /personal/download/{path...}`
- `GET /personal/stream/{path...}`

Personal routes must:

- Resolve paths only inside `config.PersonalDir()`.
- Reject absolute paths, traversal, Windows volume prefixes, and symlink escapes.
- Require a bearer token or equivalent account proof from mobile.
- Verify the token belongs to the same server account as the desktop session currently synced to sidecar.
- Return `401` when no valid mobile account token is present.
- Return `403` when mobile is authenticated but not the same account as the desktop.

Team shared routes keep their current local-network behavior and should not require the personal auth token.

## Desktop Client

Desktop sidecar settings should return:

- `rootPath`
- `sharedPath`
- `personalPath`
- `receivePath`

Desktop UI changes:

- Rename visible "shared directory" copy to "team shared directory".
- Add a personal directory row/card in path settings.
- Show receive directory as nested under personal directory.
- Directory page tabs should become:
  - Received
  - Team Shared
  - Personal

Renderer continues to call preload/main APIs. Main process forwards sidecar calls. Renderer does not call the filesystem, SQLite, or sidecar directly.

Desktop auth changes:

- The main process already stores the desktop auth session and syncs tunnel credentials to sidecar.
- Extend that sync so sidecar knows the desktop account identity needed for personal-route authorization.
- Sidecar must clear the desktop identity on logout or credential clearing.

## Mobile Client

Mobile should distinguish directory scope:

- Team shared browsing uses existing `/shared/*` behavior and can continue over LAN/P2P.
- Personal browsing uses `/personal/*` and must attach the mobile access token.

JS service changes:

- Add scoped APIs such as `browseDirectory(scope, path)`, `downloadDirectoryFile(scope, path)`, and `getDirectoryFileStreamUrl(scope, path)`.
- Keep existing shared wrappers for compatibility where useful.

Native iOS/Android changes:

- Replace hard-coded shared endpoints with scoped endpoint builders.
- Add Authorization headers for personal routes only.
- Preserve existing shared route policy: prefer reachable LAN, use P2P when needed, and keep existing reachability telemetry.

UI changes:

- The current shared files screen can become a two-tab file browser: Team Shared and Personal.
- Download subscription gates stay in place.
- Completed download tracking should include scope in the storage key or completed-download id to avoid collisions between identical paths in team and personal roots.

## Server

Server currently validates same-account ownership only during WebSocket signaling for a known `targetClientId`. It does not expose a persistent same-account desktop inventory. Add minimal server support:

1. Add `desktop_devices` table with:
   - `id`
   - `user_id`
   - `client_id`
   - `display_name`
   - `platform`
   - `capabilities`
   - `last_seen_at`
   - `revoked_at`
2. Add authenticated desktop register/heartbeat endpoint.
3. Add authenticated mobile discovery endpoint that returns only desktops owned by the current `user_id`.
4. Keep signaling same-account checks, and prefer validating target ownership against the registry when available.

This server layer establishes the account boundary used by personal directory discovery and tunnel setup. The actual file bytes still flow between mobile and desktop over LAN/P2P sidecar routes.

## Error Handling

- Personal route without mobile token: `401 auth required`.
- Personal route with wrong account: `403 account mismatch`.
- Desktop has no synced account identity: personal route returns `401 desktop account required`.
- Path traversal or symlink escape: `400`.
- Missing directory/file: `404`.
- Storage path unavailable: existing storage-unavailable error path.
- Migration conflict: leave source untouched, report/log conflict, and keep the current receive path until user intervention.

## Testing

Client:

- Contracts type tests/build for new DTO fields.
- Go sidecar tests for:
  - `PersonalDir()` and `SharedDir()` layout.
  - settings derivation.
  - legacy `<root>/received` migration.
  - personal path traversal and symlink escape rejection.
  - personal route `401`/`403`/success.
  - shared route remains accessible.
- Desktop renderer/store tests for new paths and tabs.
- Desktop main/preload tests for new sidecar methods.
- Mobile TypeScript tests for scoped API wrappers and UI tabs.
- iOS/Android native tests or focused build/type validation for scoped endpoint construction and personal auth header behavior.

Server:

- Migration/repository tests for `desktop_devices`.
- Authenticated register/heartbeat tests.
- Mobile discovery returns only same-account desktops.
- Signaling ownership checks continue to reject cross-account target desktop.

## Rollout Notes

- Existing `/shared/*` remains stable for older clients.
- New personal routes require updated desktop sidecar and mobile app.
- If mobile does not support personal scope, it continues to browse team shared files only.
- Migration should run locally on desktop only; no build or migration work is performed on remote servers.
