# Vivi Drop Mobile UI v0 Alignment Design Spec

## Goal
Modify the React Native mobile app (`apps/mobile/src/...`) to align 1:1 with the v0 prototype design defined in `/Volumes/T7/Dev/Web/SyncFlow/vividrop-ui-mobile`.

This includes updating the color palette, fonts, spacing, layout cards, headers, queue lists, status badges, actions, and dialogs.

## Color System Mapping
We will update `apps/mobile/src/theme/colors.ts` with modern hex equivalents derived from the OKLCH variables in `vividrop-ui-mobile/app/globals.css`:

```typescript
export const colors = {
  // Base
  background: '#F7F9FC',      // oklch(0.99 0.002 240)
  foreground: '#1C1C1E',      // oklch(0.15 0.02 240)
  card: '#FFFFFF',            // oklch(1 0 0)
  cardForeground: '#1C1C1E',

  // Semantic
  primary: '#1A3A5C',         // Deep Navy used for mobile headers, primary text, buttons
  primaryForeground: '#FFFFFF',
  secondary: '#F0F4F8',       // oklch(0.96 0.01 240)
  secondaryForeground: '#5A7A96', // oklch(0.30 0.02 240)
  muted: '#EBF0F5',           // oklch(0.96 0.008 240)
  mutedForeground: '#8AABBD', // oklch(0.50 0.02 240)
  accent: '#3B9FD8',          // Accent blue for active sync items and highlights
  accentForeground: '#FFFFFF',
  destructive: '#EF4444',     // oklch(0.577 0.245 27.325)
  destructiveForeground: '#FFFFFF',

  // Border / Input
  border: 'rgba(0,0,0,0.05)',  // oklch(0.92 0.01 240)
  input: '#F0F4F8',
  ring: '#1A3A5C',

  // Status
  success: '#16A34A',         // oklch(0.65 0.17 150)
  successForeground: '#FFFFFF',
  warning: '#F59E0B',         // oklch(0.75 0.15 65)
  warningForeground: '#D97706',

  // Screen background & title (legacy compatibility overrides)
  screenBackground: '#F7F9FC',
  screenTitle: '#1A3A5C',
} as const;
```

## Screen Modifications

### 1. Sync Activity Screen (`SyncActivityScreen.tsx`)
- **Header:** Header bar styled with deep navy title `同步动态` (`#1A3A5C`), and three Lucide-equivalent icons on the right (Help, History, Settings) utilizing custom touch targets.
- **Connection Card:** Rounded card with device computer icon, online/offline status badge, and desktop detail labels.
- **Sync State Panel:** Styled dynamically according to global state:
  - **Manual Uploading:** shows 'Manual' tag, progress bar, speed/progress/transferred info columns.
  - **Manual Completed:** shows green completion bar, 'Go to Album to Continue Uploading' button, and 'Turn on Auto Sync' if applicable.
  - **Auto Uploading:** shows 'Auto' tag, progress bar, speed/progress/transferred info columns.
  - **Auto Completed:** shows completed tag, 'Go to Album' and 'Turn off Auto Upload' buttons.
  - **Idle / Auto Upload Off:** shows 'Auto Upload Disabled' icon, description, and 'Start Auto Sync' button.
  - **Expired / Subscription Required:** paywall banner, subscription buttons.
- **Queue List:** Row items with doc/video/image icons, formatted size text, and status badges.
- **Layout:** High-fidelity padding, drop shadows, and modern fonts.

### 2. Settings Screen (`SettingsScreen.tsx`)
- **Header & Title:** Modern header with title `设置` and back chevron.
- **Section Groups:** Menu list grouped into card-style rounded boxes (`borderRadius: 16`), thin borders, and soft shadows.
- **Account Card:** User info list row with pink-background user icon container, Pro/Trial/Expired status badge, and trial days remaining indicator.
- **Connection Card:** Details of current PC connection, status badge, and "Forget/Delete Device" red trash action.
- **Diagnostics modal:** Styling dialog form for reporting bugs/logs.

### 3. Shared Files Screen (`SharedFilesScreen.tsx`)
- **Tabs:** Segmented tabs for "Shared" and "Received" matching prototype aesthetics.
- **Lists:** Icon indicators for folder/document/image/video files.
- **Status Badge:** Download action buttons, spinners, and green checkmark icons for downloaded items.

### 4. Device Discovery & Verify screens (`DeviceDiscoveryScreen.tsx` / `CodeVerifyScreen.tsx`)
- **Scanning Rings:** Circular pulsing scans with customizable speed.
- **Sections:** "Recent Desktops" and "Discovered Desktops" sections with clear separators.
- **Verify Input:** Secure code input layout with explicit instructions and permanent block warnings.

## Open Risks
- Verify that custom SVGs and standard icons render properly on both iOS and Android.
- Ensure that updating colors in `colors.ts` does not break other screens that might rely on custom colors.
- Maintain existing logic and state management stores (`auth-store.ts`, `recent-desktops-store.ts`) intact.
