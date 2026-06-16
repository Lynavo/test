# Global Connection Feature Guide Design

## Context

Global mobile UI restoration uses `/Volumes/workspace/work/vividrop-ui-mobile` as the visual reference while preserving the current React Native app's real navigation, sync state, native modules, auth state, and DTO boundaries.

The existing global connection guide started as a broad multi-step tour. After review, the guide should not preview whole pages like Home or My, and it should not teach verification choices such as scan code versus connection code. Those are real connection-flow actions that users see immediately after selecting a device.

## Goal

Create a first-run global guide on the connection screen that previews the product's most important feature entry points, similar to the reference project's onboarding intent, without changing real navigation or creating a fake connected state.

The guide should help users understand what they can do after connecting:

- Start from selecting a desktop device.
- Enable automatic upload.
- Choose upload content and range.
- Monitor sync progress.
- Review recent downloads and sync records.
- Open remote resources and access desktop files.

## Non-Goals

- Do not navigate to real Home, Remote Resources, Settings, My, or Auto Upload pages during the guide.
- Do not reuse real post-login page components inside the guide.
- Do not trigger real API calls, native sync calls, subscription gates, permission prompts, tab state changes, or persisted screen state.
- Do not include a dedicated guide step for scan connection, connection code entry, or manual verification.
- Do not guide the full My page. Account, language, subscription, logout, and delete account flows remain discoverable in the actual Settings/My page.

## UX Model

The real screen underneath remains `DeviceDiscoveryGlobalScreen`.

The guide is a modal overlay with two modes:

1. **Real spotlight step**: the first step highlights the actual device list on the connection page.
2. **Pseudo feature preview steps**: later steps show lightweight preview cards inside the overlay. These cards represent feature entry points but do not mount or navigate to the real screens.

The copy must explicitly state that the guide is a preview and will not create a real connection or change sync settings.

## Step Sequence

### 1. Connect Desktop

Target: actual nearby device list.

Purpose: tell users the first action is selecting a desktop on the same network.

Primary action: `继续预览`

### 2. Enable Auto Upload

Target: pseudo feature preview card.

Purpose: explain the most important post-connect capability: new photos, videos, and files can sync quietly to the desktop.

Primary action: `下一步`

### 3. Choose Upload Content And Range

Target: pseudo feature preview card.

Purpose: combine the reference project's upload source, upload range, and confirm-upload steps into one shorter step.

Primary action: `下一步`

### 4. Monitor Sync Progress

Target: pseudo feature preview card.

Purpose: explain sync state, cumulative synced files, recent sync time, and paused/failed state visibility.

Primary action: `下一步`

### 5. Recent Downloads And Sync Records

Target: pseudo feature preview card.

Purpose: explain where users can find files downloaded from desktop to phone and completed sync history.

Primary action: `下一步`

### 6. Remote Resources And Desktop Access

Target: pseudo feature preview card.

Purpose: explain the Remote Resources tab and the remote desktop access card as the entry to browse desktop files.

Primary action: `完成`

## Component Boundaries

Add global-only guide components. Do not modify CN onboarding components.

Recommended structure:

- `DeviceDiscoveryGlobalScreen` owns guide visibility, first-step spotlight measurement, dismissal, and persistence.
- `GlobalConnectionFeatureGuideOverlay` renders guide chrome, progress dots, actions, and step content.
- `GlobalConnectionFeaturePreviewCard` renders pseudo feature preview cards for steps 2-6.
- A small step config array describes title, body, action label, and preview kind.

The existing `hasSeenUnconnectedGuide` / `markUnconnectedGuideSeen` storage can be reused if its naming remains acceptable for both markets. If naming becomes confusing, introduce a global-specific wrapper while keeping persisted semantics compatible.

## State And Persistence

Show the guide only when:

- Market is global.
- User is on the initial connection page, not switch-desktop mode.
- The guide has not been marked seen.

Mark the guide seen when:

- User taps `跳过引导`.
- User reaches the final step and taps `完成`.
- User starts a real connection by selecting a device.
- User leaves the connection page through back/reset navigation.

Do not mark the guide seen just because device discovery times out or no devices are found.

## Interaction Rules

- `下一步` increments internal guide step only.
- `跳过引导` dismisses and persists seen state.
- Selecting a real device dismisses the guide and continues the real connection flow.
- The overlay should block accidental taps on preview-only content.
- The first step should preserve visibility of the device list under the spotlight.
- Later steps should not require measuring real post-connect targets.

## Visual Direction

Use the existing global visual language:

- Global gradient background remains visible underneath.
- Dark translucent spotlight backdrop for the first step.
- Glass-like guide card consistent with global modal/backdrop treatment.
- Progress dots show six steps.
- Primary button uses global blue.
- Secondary skip action remains low-emphasis.

Pseudo feature preview cards should look like simplified entry previews, not screenshots of full pages.

## Accessibility

- The guide card title should be readable by screen readers.
- Actions need accessible labels.
- Progress should be represented in text such as `1/6`, not only dots.
- Preview-only cards should not expose fake actionable controls.

## Testing

Add or update targeted tests for:

- First-run global guide renders on initial connection page.
- Switch mode does not show the guide.
- First step keeps the real device list visible.
- Step progression reaches the six configured steps without navigation calls.
- Skip marks the guide seen.
- Final completion marks the guide seen.
- Selecting a real device dismisses the guide and proceeds to the real connection modal.
- Pseudo preview steps do not call `navigation.navigate`.

Manual visual checks:

- iOS global debug initial connection screen.
- Android global debug initial connection screen.
- Device list available, no device found, and scanning states.
- Safe-area behavior on small and tall screens.

## Open Decisions

None. The approved direction is a six-step global-only feature-entry guide with pseudo preview steps and no real page navigation.
