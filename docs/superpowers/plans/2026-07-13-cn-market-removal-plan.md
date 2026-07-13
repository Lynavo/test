# CN Market Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining CN-market and former dual-market source structure while preserving the complete `en`, `zh-Hant`, and `zh-Hans` i18n system.

**Architecture:** Tighten the existing OSS source verifier first, then remove independent dead surfaces in contracts, desktop, mobile, and iOS. The surviving application uses neutral names and derives locale-sensitive behavior from the selected language or system locale; sync DTOs, protocol, persistence, queue semantics, and state machines remain untouched.

**Tech Stack:** Node.js test runner, TypeScript 5.8, React 18.3, Electron/Vitest, React Native/Jest, i18next, Xcode project metadata, pnpm/turbo.

---

## File Map

- `scripts/verify-oss-source-package.mjs`: reject known CN-market paths and configuration without treating localization as market code.
- `scripts/release/__tests__/oss-source-package.test.mjs`: cover forbidden market artifacts and explicit `zh-Hans`/`cn()` allowances.
- `packages/contracts/{package.json,tsconfig.esm.json,src/index.ts,src/__tests__/exports.test.ts}`: remove the unused countries export surface.
- `packages/contracts/src/countries.ts`, `apps/mobile/src/constants/countries.ts`: delete unused country-code data and mobile shim.
- `apps/desktop/src/shared/product.ts`, `apps/desktop/src/shared/__tests__/product.test.ts`: remove the constant global-product predicate while preserving product name and release channel behavior.
- `apps/desktop/src/renderer/features/settings/SettingsPage.tsx`: remove the permanently unreachable regional guidance branch.
- `apps/desktop/src/renderer/features/settings/{ShareAddressSection,SystemGuideSection}.tsx`: delete unreachable UI.
- `apps/desktop/src/renderer/features/settings/__tests__/{SettingsPage,ShareAddressSection,SystemGuideSection}.test.tsx`: remove dead-subject tests and update the live Settings test.
- `apps/desktop/src/renderer/i18n/locales/{en,zh-Hans,zh-Hant}/settings.json`: remove keys used only by deleted UI.
- `apps/desktop/src/renderer/{index.html,i18n/index.ts,i18n/__tests__/index.test.ts}`: use neutral bootstrap metadata and synchronize document language with i18next.
- `apps/mobile/src/screens/*Screen.tsx`: delete old unreachable variants, then rename active `*GlobalScreen` implementations to canonical `*Screen` names.
- `apps/mobile/src/navigation/RootNavigator.tsx`, navigation tests, and active screen tests: update imports, mocks, component names, diagnostic labels, and test file names for canonical screens.
- `apps/mobile/src/screens/{AlbumWorkbench,LocalComputer,PhoneSyncSpace,Settings}Screen.tsx`: remove hard-coded China/Simplified-Chinese runtime defaults.
- `apps/mobile/src/i18n/__tests__/locale-resolver.test.ts` and affected fixture tests: keep script-based Simplified Chinese coverage without `CN` country fixtures.
- `apps/mobile/ios/LynavoDrive.xcodeproj/project.pbxproj`: set English development region and neutral app icon name.
- `apps/mobile/ios/LynavoDrive/Images.xcassets/AppIconGlobal.appiconset/`: delete duplicate icon catalog.

### Task 1: Add The OSS Market Boundary Guard

**Files:**

- Modify: `scripts/release/__tests__/oss-source-package.test.mjs`
- Modify: `scripts/verify-oss-source-package.mjs`

- [ ] **Step 1: Add a failing verifier test for forbidden market residue and valid i18n/helpers**

Add a fixture test containing these exact representative paths and contents:

```js
test('blocks CN market source structure without blocking localization or class helpers', () => {
  const fixtureRoot = createTrackedFixture({
    'apps/mobile/android/app/src/cn/MarketConfig.kt': 'object MarketConfig\n',
    'apps/mobile/ios/LynavoDriveCN.xcscheme/contents.xcscheme': '<Scheme />\n',
    'apps/desktop/electron-builder.cn.yml': 'appId: com.example.cn\n',
    'scripts/release/release-profiles.mjs': "export const profile = 'cn';\n",
    'apps/mobile/src/payments/WeChatPay.ts': 'export const enabled = true;\n',
    'apps/mobile/src/i18n/locales/zh-Hans/common.json': '{}\n',
    'apps/desktop/src/renderer/lib/utils.ts': 'export function cn() {}\n',
  });
  try {
    const result = runVerifier(['--root', fixtureRoot]);

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /Disallowed OSS source package files: 5/);
    assert.match(result.stdout, /android\/app\/src\/cn\/MarketConfig\.kt/);
    assert.match(result.stdout, /LynavoDriveCN\.xcscheme/);
    assert.match(result.stdout, /electron-builder\.cn\.yml/);
    assert.match(result.stdout, /release-profiles\.mjs/);
    assert.match(result.stdout, /payments\/WeChatPay\.ts/);
    assert.doesNotMatch(result.stdout, /zh-Hans\/common\.json/);
    assert.doesNotMatch(result.stdout, /renderer\/lib\/utils\.ts/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --test-name-pattern='CN market source structure' scripts/release/__tests__/oss-source-package.test.mjs`

Expected: FAIL because all seven fixture files are currently accepted.

- [ ] **Step 3: Implement narrow path and content checks**

Add explicit regular expressions near the other verifier constants and call them from `disallowReason()` before generic artifact checks:

```js
const CN_MARKET_PATH_PATTERNS = [
  /(^|\/)src\/cn(\/|$)/iu,
  /(^|\/)[^/]*cn\.xcscheme(\/|$)/iu,
  /(^|\/)electron-builder\.cn\.ya?ml$/iu,
  /(^|\/)(?:payments?|market)\/[^/]*(?:wechat|alipay|cn-market)[^/]*$/iu,
];

const CN_MARKET_CONTENT_PATTERNS = [
  /\b(?:SYNCFLOW|LYNAVO)_(?:MARKET|REGION)\s*=\s*['\"]?cn\b/iu,
  /\b(?:profile|market|region)\s*[:=]\s*['\"]cn['\"]/iu,
];
```

Read text only for source/config extensions (`.cjs`, `.js`, `.json`, `.mjs`, `.ts`, `.tsx`, `.yml`, `.yaml`) and return stable reasons:

```js
function cnMarketDisallowReason(path, root) {
  if (CN_MARKET_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
    return 'CN market-specific source or build path';
  }
  if (!CN_MARKET_CONTENT_EXTENSIONS.has(extname(path))) return null;
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) return null;
  const content = readFileSync(absolutePath, 'utf8');
  return CN_MARKET_CONTENT_PATTERNS.some((pattern) => pattern.test(content))
    ? 'CN market-specific configuration'
    : null;
}
```

The patterns must not include `zh-Hans`, bare `CN` locale tags, or a bare `cn()` identifier.

- [ ] **Step 4: Run verifier tests and verify GREEN**

Run: `node --test scripts/release/__tests__/oss-source-package.test.mjs`

Expected: PASS for all OSS source package tests, including the new five-forbidden/two-allowed fixture.

- [ ] **Step 5: Commit the guard**

```bash
git add scripts/verify-oss-source-package.mjs scripts/release/__tests__/oss-source-package.test.mjs
git commit -m "test: guard OSS source from CN market residue"
```

### Task 2: Remove The Unused Country-Code Contract Surface

**Files:**

- Delete: `packages/contracts/src/countries.ts`
- Delete: `apps/mobile/src/constants/countries.ts`
- Modify: `packages/contracts/package.json`
- Modify: `packages/contracts/tsconfig.esm.json`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/__tests__/exports.test.ts`

- [ ] **Step 1: Remove the countries export assertion and run the contract test**

Delete only these assertions from `exports.test.ts`:

```ts
expect(contracts.COUNTRY_CODES.find((country) => country.iso === 'CN')?.code).toBe('+86');
expect(contracts.COUNTRY_CODES.find((country) => country.iso === 'TW')?.code).toBe('+886');
```

Run: `pnpm --filter @lynavo-drive/contracts test`

Expected: PASS; this proves country codes are not part of any remaining behavior test.

- [ ] **Step 2: Remove all export/build entry points**

Delete `export * from './countries';` from `src/index.ts`, delete the `./countries` subpath from `package.json`, and change `tsconfig.esm.json` to compile the package entry point:

```json
"include": ["src/index.ts"]
```

Delete both source files listed above.

- [ ] **Step 3: Verify no consumer remains**

Run: `rg -n 'COUNTRY_CODES|CountryCodeInfo|@lynavo-drive/contracts/countries|constants/countries' packages apps`

Expected: no output.

- [ ] **Step 4: Rebuild shared packages and typecheck the contract**

Run: `pnpm build && pnpm --filter @lynavo-drive/contracts typecheck`

Expected: both commands exit 0.

- [ ] **Step 5: Commit the contract cleanup**

```bash
git add packages/contracts apps/mobile/src/constants/countries.ts
git commit -m "refactor: remove unused country code contract"
```

### Task 3: Remove Desktop Variant Dead Code

**Files:**

- Delete: `apps/desktop/src/renderer/features/settings/ShareAddressSection.tsx`
- Delete: `apps/desktop/src/renderer/features/settings/SystemGuideSection.tsx`
- Delete: `apps/desktop/src/renderer/features/settings/__tests__/ShareAddressSection.test.tsx`
- Delete: `apps/desktop/src/renderer/features/settings/__tests__/SystemGuideSection.test.tsx`
- Modify: `apps/desktop/src/shared/product.ts`
- Modify: `apps/desktop/src/shared/__tests__/product.test.ts`
- Modify: `apps/desktop/src/renderer/features/settings/SettingsPage.tsx`
- Modify: `apps/desktop/src/renderer/features/settings/__tests__/SettingsPage.test.tsx`
- Modify: `apps/desktop/src/renderer/i18n/locales/en/settings.json`
- Modify: `apps/desktop/src/renderer/i18n/locales/zh-Hans/settings.json`
- Modify: `apps/desktop/src/renderer/i18n/locales/zh-Hant/settings.json`

- [ ] **Step 1: Remove assertions that codify the obsolete variant branch**

Delete the `isLynavoGlobalProduct` import/test from `product.test.ts` and the Settings test that asserts regional sharing guidance is hidden for the global product.

- [ ] **Step 2: Remove the predicate and unreachable branch**

Delete this function from `product.ts`:

```ts
export function isLynavoGlobalProduct(): boolean {
  return true;
}
```

In `SettingsPage.tsx`, keep `getProductName`, remove the two dead component imports, remove `showLocalShareGuidance`, and delete the conditional JSX containing `ShareAddressSection` and `SystemGuideSection`.

- [ ] **Step 3: Delete dead components/tests and their isolated translations**

Delete the four component/test files. From each language's `settings.json`, delete the complete top-level `shareAddress` and `systemGuide` objects, then validate JSON syntax.

Run: `node -e "for (const p of process.argv.slice(1)) JSON.parse(require('node:fs').readFileSync(p, 'utf8'))" apps/desktop/src/renderer/i18n/locales/{en,zh-Hans,zh-Hant}/settings.json`

Expected: exit 0.

- [ ] **Step 4: Run focused Desktop tests**

Run: `pnpm --filter @lynavo-drive/desktop test -- src/shared/__tests__/product.test.ts src/renderer/features/settings/__tests__/SettingsPage.test.tsx src/renderer/i18n/__tests__/resources.test.ts`

Expected: PASS; i18n resource parity still includes all three locales.

- [ ] **Step 5: Confirm variant symbols are gone and commit**

Run: `rg -n 'isLynavoGlobalProduct|showLocalShareGuidance|ShareAddressSection|SystemGuideSection' apps/desktop/src`

Expected: no output.

```bash
git add apps/desktop/src/shared apps/desktop/src/renderer/features/settings apps/desktop/src/renderer/i18n/locales
git commit -m "refactor: remove desktop market variant dead code"
```

### Task 4: Synchronize Desktop Document Locale

**Files:**

- Modify: `apps/desktop/src/renderer/index.html`
- Modify: `apps/desktop/src/renderer/i18n/index.ts`
- Modify: `apps/desktop/src/renderer/i18n/__tests__/index.test.ts`

- [ ] **Step 1: Add failing document-language assertions**

Extend the existing i18n module test to assert both initialization and language changes:

```ts
expect(document.documentElement.lang).toBe('zh-Hant');
await i18next.changeLanguage('zh-Hans');
expect(document.documentElement.lang).toBe('zh-Hans');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @lynavo-drive/desktop test -- src/renderer/i18n/__tests__/index.test.ts`

Expected: FAIL because the module does not currently update `document.documentElement.lang`.

- [ ] **Step 3: Add the initial and runtime synchronization**

In `i18n/index.ts`, set the DOM before initialization and listen for later changes:

```ts
function syncDocumentLanguage(locale: string): void {
  document.documentElement.lang = isSupportedLocale(locale) ? locale : resolveLocale([locale]);
}

syncDocumentLanguage(lng);
i18next.on('languageChanged', syncDocumentLanguage);
```

Change the bootstrap markup to `<html lang="en">`.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm --filter @lynavo-drive/desktop test -- src/renderer/i18n/__tests__/index.test.ts src/renderer/i18n/__tests__/locale-resolver.test.ts`

Expected: PASS, with `zh-Hans` resolver coverage retained.

```bash
git add apps/desktop/src/renderer/index.html apps/desktop/src/renderer/i18n
git commit -m "fix: synchronize desktop document locale"
```

### Task 5: Canonicalize Mobile Screen Implementations

**Files:**

- Replace with active implementation: `apps/mobile/src/screens/{AutoUploadSettings,DeviceDiscovery,Help,History,LocalComputer,PhoneSyncSpace,Settings,SharedFiles,SyncActivity}Screen.tsx`
- Create from active variant: `apps/mobile/src/screens/DownloadRecordsScreen.tsx`
- Delete: `apps/mobile/src/screens/{AutoUploadSettings,DeviceDiscovery,DownloadRecords,Help,History,LocalComputer,PhoneSyncSpace,Settings,SharedFiles,SyncActivity}GlobalScreen.tsx`
- Delete obsolete-subject tests: `apps/mobile/src/screens/__tests__/DeviceDiscoveryScreen.onboarding.test.tsx`, `apps/mobile/src/screens/__tests__/DeviceDiscoveryScreen.pairingOptions.test.tsx`, `apps/mobile/src/screens/__tests__/DeviceDiscoveryScreen.switchMode.test.tsx`, `apps/mobile/src/screens/__tests__/SyncActivityScreen.header.test.tsx`, `apps/mobile/src/screens/__tests__/SyncActivityScreen.onboarding.test.tsx`
- Rename active tests: `apps/mobile/src/screens/__tests__/{AutoUploadSettings,DeviceDiscovery,DownloadRecords,Help,History,Settings,SyncActivity}GlobalScreen*.test.tsx`
- Modify: `apps/mobile/src/screens/__tests__/SharedFilesDownloadGate.test.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Modify: `apps/mobile/src/navigation/__tests__/RootNavigator.fail-open.test.tsx`
- Modify: `apps/mobile/src/navigation/__tests__/RootNavigator.local-mode.test.tsx`
- Modify: `apps/mobile/src/navigation/__tests__/RootNavigator.pairingInvalidation.test.tsx`

- [ ] **Step 1: Establish the current navigation baseline**

Run: `pnpm --filter @lynavo-drive/mobile test -- --runInBand src/navigation/__tests__/RootNavigator.fail-open.test.tsx src/navigation/__tests__/RootNavigator.local-mode.test.tsx src/navigation/__tests__/RootNavigator.pairingInvalidation.test.tsx`

Expected: PASS before rename.

- [ ] **Step 2: Delete old unsuffixed subjects and install active files under canonical paths**

For every family in the Files list, delete the old unsuffixed implementation first, move the corresponding `*GlobalScreen.tsx` to `*Screen.tsx`, and rename its exported component, props type, test IDs, and diagnostic log prefix from `XGlobalScreen` to `XScreen`. `DownloadRecordsScreen.tsx` is created solely by moving its active global file because no unsuffixed file exists.

Examples of required final declarations:

```ts
export function DeviceDiscoveryScreen() {
  /* existing active body */
}
export function SyncActivityScreen({ showBottomTabBar = true }: SyncActivityScreenProps) {
  /* existing active body */
}
export function SettingsScreen({ showBottomTabBar = true }: SettingsScreenProps) {
  /* existing active body */
}
```

- [ ] **Step 3: Rename active tests and update navigation/mocks atomically**

Rename each active `*GlobalScreen*.test.tsx` file to the matching canonical name. Replace imports, Jest module paths, mock export keys, JSX component names, describe names, helper names, and string diagnostic screen labels in all files listed above. Preserve route names such as `History`, `Settings`, and `SharedFiles`.

- [ ] **Step 4: Confirm no product-variant screen identifier remains**

Run: `rg -n 'GlobalScreen' apps/mobile/src`

Expected: no output.

- [ ] **Step 5: Run navigation and active screen tests**

Run: `pnpm --filter @lynavo-drive/mobile test -- --runInBand src/navigation/__tests__ src/screens/__tests__`

Expected: PASS. Any failures must be import/name regressions only; do not change navigation, pairing, download gate, or sync behavior to make them pass.

- [ ] **Step 6: Commit the canonical screen transition**

```bash
git add apps/mobile/src/navigation apps/mobile/src/screens
git commit -m "refactor: canonicalize mobile screen names"
```

### Task 6: Remove Mobile China-Locale Defaults And Fixtures

**Files:**

- Modify: `apps/mobile/src/screens/AlbumWorkbenchScreen.tsx`
- Modify: `apps/mobile/src/screens/LocalComputerScreen.tsx`
- Modify: `apps/mobile/src/screens/PhoneSyncSpaceScreen.tsx`
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx`
- Modify: `apps/mobile/src/i18n/__tests__/locale-resolver.test.ts`
- Modify: all mobile tests reported by `rg -l 'zh-(?:CN|Hans-CN)|countryCode: .CN.' apps/mobile/src --glob '*test*'`

- [ ] **Step 1: Add failing tests for locale-derived settings and sorting**

In the canonical Settings test, initialize mocked i18n with `language: 'en'` and assert the English option is selected instead of `zh-Hans`. In the shared-files/download-gate test, mock `i18n.language` as `zh-Hant` and spy on `String.prototype.localeCompare` to assert it receives `zh-Hant` rather than `zh-CN`.

- [ ] **Step 2: Run the locale-focused tests and verify RED**

Run: `pnpm --filter @lynavo-drive/mobile test -- --runInBand src/screens/__tests__/SettingsScreen.test.tsx src/screens/__tests__/SharedFilesDownloadGate.test.tsx`

Expected: FAIL on the hard-coded initial language and sort locale.

- [ ] **Step 3: Derive runtime locale from i18next/system settings**

Use the existing `useTranslation()` result in active screens:

```ts
const activeLocale = i18n.resolvedLanguage ?? i18n.language;
```

Pass `activeLocale` to `localeCompare`. Initialize Settings state with a supported current i18n language, falling back to `en`, rather than literal `zh-Hans`. For `DateTimePicker`, use the active supported locale on iOS and omit a country-specific literal.

- [ ] **Step 4: Make Simplified Chinese fixtures script-based**

Replace `zh-Hans-CN` fixtures with `zh-Hans` and remove `countryCode: 'CN'` where the test is intended only to prove script resolution. Retain explicit resolver coverage that `languageCode: 'zh'` plus `scriptCode: 'Hans'` resolves to `zh-Hans`; keep the `zh-Hans` resource and language option unchanged.

- [ ] **Step 5: Run mobile i18n, settings, history, navigation, and shared-file tests**

Run: `pnpm --filter @lynavo-drive/mobile test -- --runInBand src/i18n/__tests__ src/navigation/__tests__ src/screens/__tests__`

Expected: PASS.

- [ ] **Step 6: Confirm country-specific locale literals are gone and commit**

Run: `rg -n 'zh-CN|zh-Hans-CN|countryCode: ['\"]CN['\"]' apps/mobile/src apps/desktop/src --glob '!**/locales/zh-Hans/**'`

Expected: no output.

```bash
git add apps/mobile/src apps/desktop/src/renderer/i18n/__tests__/locale-resolver.test.ts
git commit -m "fix: derive runtime locale without China defaults"
```

### Task 7: Neutralize iOS Metadata And App Icon Selection

**Files:**

- Modify: `apps/mobile/ios/LynavoDrive.xcodeproj/project.pbxproj`
- Delete: `apps/mobile/ios/LynavoDrive/Images.xcassets/AppIconGlobal.appiconset/Contents.json`
- Delete: all PNG files under `apps/mobile/ios/LynavoDrive/Images.xcassets/AppIconGlobal.appiconset/`

- [ ] **Step 1: Prove both icon catalogs are byte-identical before deletion**

Run: `for f in apps/mobile/ios/LynavoDrive/Images.xcassets/AppIcon.appiconset/*.png; do cmp "$f" "${f/AppIcon.appiconset/AppIconGlobal.appiconset}"; done`

Expected: exit 0 with no output.

- [ ] **Step 2: Update Xcode metadata**

Set:

```text
developmentRegion = en;
ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
```

Apply `AppIcon` to both Debug and Release build configurations while leaving `knownRegions` entries for `en`, `Base`, `zh-Hans`, and any existing localization resources intact.

- [ ] **Step 3: Delete only the duplicate global icon catalog**

Delete `AppIconGlobal.appiconset` in full. Do not modify any file in `AppIcon.appiconset`.

- [ ] **Step 4: Validate project metadata and icon references**

Run: `rg -n 'AppIconGlobal|developmentRegion = "zh-Hans"' apps/mobile/ios`

Expected: no output.

Run: `xcodebuild -project apps/mobile/ios/LynavoDrive.xcodeproj -target LynavoDrive -showBuildSettings | rg 'ASSETCATALOG_COMPILER_APPICON_NAME|DEVELOPMENT_LANGUAGE'`

Expected: app icon is `AppIcon`; command exits 0.

- [ ] **Step 5: Commit iOS cleanup**

```bash
git add apps/mobile/ios/LynavoDrive.xcodeproj/project.pbxproj apps/mobile/ios/LynavoDrive/Images.xcassets
git commit -m "refactor: neutralize iOS market metadata"
```

### Task 8: Full Verification And Residue Audit

**Files:**

- Modify only files already in scope if validation finds a cleanup regression.

- [ ] **Step 1: Run formatting and focused static scans**

Run: `pnpm format:check`

Expected: exit 0.

Run: `rg -n 'GlobalScreen|isLynavoGlobalProduct|COUNTRY_CODES|CountryCodeInfo|AppIconGlobal|zh-CN|zh-Hans-CN|SYNCFLOW_MARKET|LYNAVO_MARKET|electron-builder\.cn|src/cn' apps packages scripts --glob '!**/locales/zh-Hans/**' --glob '!scripts/release/__tests__/oss-source-package.test.mjs'`

Expected: no active-source matches. Review any documentation or negative-guard matches manually instead of broadening the guard to reject valid `zh-Hans` or `cn()`.

- [ ] **Step 2: Build shared packages, typecheck Desktop/Mobile, and run TypeScript tests**

Run: `pnpm build`

Expected: exit 0.

Run: `pnpm --filter @lynavo-drive/desktop typecheck && pnpm --filter @lynavo-drive/mobile exec tsc --noEmit`

Expected: both exit 0.

Run: `pnpm --filter @lynavo-drive/contracts test && pnpm --filter @lynavo-drive/desktop test && pnpm --filter @lynavo-drive/mobile test -- --runInBand`

Expected: all suites PASS.

- [ ] **Step 3: Run the OSS release gate**

Run: `pnpm gate:release`

Expected: exit 0; worktree and HEAD verifier modes, release tests, and both release-profile dry runs pass.

- [ ] **Step 4: Run native mobile regression builds where locally available**

Run: `cd apps/mobile/ios && xcodebuild -workspace LynavoDrive.xcworkspace -scheme LynavoDrive -configuration Debug -sdk iphonesimulator -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build`

Expected: `** BUILD SUCCEEDED **`.

Run: `cd apps/mobile/android && ./gradlew assembleDebug assembleRelease`

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Self-review the final diff against contamination boundaries**

Run: `git diff --stat 7c563e15..HEAD && git diff 7c563e15..HEAD -- packages/contracts apps/desktop apps/mobile scripts`

Expected: only the planned OSS guard, unused contract, dead UI/naming, locale metadata, fixtures, and iOS icon changes. Confirm no edits to sidecar, DTO/protocol definitions, SQLite, queue ordering, sync state machine, pairing identity, permissions, or account-service gates.

- [ ] **Step 6: Commit any verification-only correction**

If validation required a scoped correction, stage only that correction and use:

```bash
git commit -m "fix: complete CN market residue cleanup"
```

If no correction was required, do not create an empty commit.
