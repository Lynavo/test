# Phase 0+1: Monorepo Bootstrap + Desktop Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the pnpm+turborepo monorepo with shared packages (contracts, design-tokens) and build a fully functional Electron desktop shell with all pages driven by mock data.

**Architecture:** pnpm workspace monorepo with turborepo for build orchestration. Desktop app uses electron-vite 5 for triple-build (main/preload/renderer). Renderer is React 18.3 + shadcn/ui (new-york) + Tailwind CSS v4 + zustand. All sidecar calls are stubbed with mock data in Phase 1; real integration happens in Phase 3.

**Tech Stack:** pnpm 10, turbo 2.8, electron-vite 5, Electron 41, React 18.3, TypeScript 5.8, Tailwind CSS 4.1, shadcn/ui CLI v4, zustand 5, vitest 4.1, electron-builder 26.8, lucide-react 0.577

**Spec:** `docs/superpowers/specs/2026-03-21-syncflow-v2-spec.md`

---

## Team Execution Strategy

Tasks marked 🔀 can be dispatched as **parallel agents**. Tasks marked 🔁 are **sequential** (must wait for dependencies).

```
Phase 0:
  T0.1 🔁 Root configs
    ├── T0.2a 🔀 contracts
    └── T0.2b 🔀 design-tokens
  T0.3 🔁 Verify + review

Phase 1:
  T1.0 🔁 Desktop bootstrap
    ├── T1.1 🔀 Main process + preload
    ├── T1.2 🔀 Stores + mocks + helpers
    └── T1.3 🔀 Layout + shared components
        ├── T1.4a 🔀 Dashboard page
        ├── T1.4b 🔀 Settings page
        └── T1.4c 🔀 Device detail modal
  T1.5 🔁 Integration + verify + review
```

After T0.3 and T1.5: dispatch `code-reviewer` agent.

---

## File Structure

### Phase 0 — Root + Packages

```
package.json                        NEW
pnpm-workspace.yaml                 NEW
turbo.json                          NEW
tsconfig.base.json                  NEW
.editorconfig                       NEW
.prettierrc                         NEW
.prettierignore                     NEW
eslint.config.mjs                   NEW
.npmrc                              NEW
.gitignore                          UPDATE

packages/contracts/
  package.json                      NEW
  tsconfig.json                     NEW
  vitest.config.ts                  NEW
  src/
    index.ts                        REWRITE (barrel only)
    protocol.ts                     NEW
    enums.ts                        NEW
    types.ts                        NEW
    events.ts                       NEW
    errors.ts                       NEW
    __tests__/exports.test.ts       NEW

packages/design-tokens/
  package.json                      NEW
  tsconfig.json                     NEW
  vitest.config.ts                  NEW
  src/
    index.ts                        NEW
    colors.ts                       NEW
    radius.ts                       NEW
    elevation.ts                    NEW
    typography.ts                   NEW
    __tests__/tokens.test.ts        NEW
```

### Phase 1 — Desktop

```
apps/desktop/
  package.json                      NEW
  electron-vite.config.ts           NEW
  vitest.config.ts                  NEW
  tsconfig.json                     NEW
  tsconfig.node.json                NEW
  tsconfig.web.json                 NEW
  components.json                   NEW
  postcss.config.mjs                NEW
  electron-builder.yml              NEW
  src/
    main/
      index.ts                      NEW (replaces electron-main/main.ts)
      sidecar-manager.ts            NEW
      ipc-handlers.ts               NEW
      file-operations.ts            NEW
    preload/
      index.ts                      NEW
      api.d.ts                      NEW
    renderer/
      index.html                    NEW
      main.tsx                      NEW
      App.tsx                       NEW
      env.d.ts                      NEW
      styles/globals.css            NEW
      lib/utils.ts                  NEW
      lib/format.ts                 NEW
      hooks/use-electron-api.ts     NEW
      stores/app-store.ts           NEW
      stores/dashboard-store.ts     NEW
      stores/settings-store.ts      NEW
      stores/device-detail-store.ts NEW
      stores/__tests__/app-store.test.ts           NEW
      stores/__tests__/dashboard-store.test.ts     NEW
      stores/__tests__/settings-store.test.ts      NEW
      stores/__tests__/device-detail-store.test.ts NEW
      mocks/devices.ts              NEW
      mocks/dashboard.ts            NEW
      mocks/files.ts                NEW
      mocks/settings.ts             NEW
      components/ui/                GENERATED (shadcn CLI)
      components/shared/CopyButton.tsx   NEW
      components/shared/GlassCard.tsx    NEW
      components/shared/StatusBadge.tsx  NEW
      components/shared/FileIcon.tsx     NEW
      components/shared/__tests__/shared.test.tsx  NEW
      features/layout/Sidebar.tsx        NEW
      features/layout/AppShell.tsx       NEW
      features/dashboard/Dashboard.tsx        NEW
      features/dashboard/StatCard.tsx         NEW
      features/dashboard/DeviceCard.tsx       NEW
      features/dashboard/DiskWarningBanner.tsx NEW
      features/device-detail/DeviceDetailModal.tsx  NEW
      features/device-detail/DeviceHeader.tsx       NEW
      features/device-detail/DateFilter.tsx         NEW
      features/device-detail/StatsBar.tsx           NEW
      features/device-detail/FileLedgerTable.tsx    NEW
      features/settings/SettingsPage.tsx             NEW
      features/settings/ConnectionCodeSection.tsx    NEW
      features/settings/FilePathSection.tsx          NEW
      features/settings/ShareAddressSection.tsx      NEW
      features/settings/SystemGuideSection.tsx       NEW
      __tests__/setup.ts            NEW
```

---

## Phase 0: Monorepo Bootstrap

### Task 0.1 🔁 Root Configuration

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `.npmrc`, `eslint.config.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "syncflow",
  "private": true,
  "engines": { "node": ">=20", "pnpm": ">=10" },
  "packageManager": "pnpm@10.32.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^8.26.0",
    "@typescript-eslint/parser": "^8.26.0",
    "eslint": "^9.22.0",
    "eslint-config-prettier": "^10.1.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "prettier": "^3.5.0",
    "turbo": "^2.8.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 6: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 7: Create `.prettierignore`**

```
node_modules
dist
.turbo
pnpm-lock.yaml
*.tsbuildinfo
```

- [ ] **Step 8: Create `.npmrc`**

```ini
shamefully-hoist=false
strict-peer-dependencies=false
```

- [ ] **Step 9: Create `eslint.config.mjs`**

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'] },
);
```

- [ ] **Step 10: Update `.gitignore`**

Append these entries:

```
node_modules/
dist/
out/
.turbo/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 11: Run `pnpm install`**

```bash
pnpm install
```

Expected: lockfile created, no errors.

- [ ] **Step 12: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .editorconfig .prettierrc .prettierignore .npmrc eslint.config.mjs .gitignore pnpm-lock.yaml
git commit -m "feat: initialize monorepo root with pnpm workspace + turborepo"
```

---

### Task 0.2a 🔀 `@syncflow/contracts`

**Can run in parallel with T0.2b after T0.1.**

**Files:**
- Create: `packages/contracts/package.json`, `tsconfig.json`, `vitest.config.ts`
- Rewrite: `packages/contracts/src/index.ts`
- Create: `src/protocol.ts`, `src/enums.ts`, `src/types.ts`, `src/events.ts`, `src/errors.ts`
- Create: `src/__tests__/exports.test.ts`

- [ ] **Step 1: Create `packages/contracts/package.json`**

```json
{
  "name": "@syncflow/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/contracts/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/contracts/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/__tests__/**/*.test.ts'] },
});
```

- [ ] **Step 4: Create `src/protocol.ts`**

Complete code from spec Section 3.1 + 3.2. Contains: `PROTOCOL_VERSION`, `PROTOCOL_PORT`, `SIDECAR_HTTP_PORT`, `BONJOUR_SERVICE_TYPE`, `CHUNK_SIZE`, `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_TIMEOUT_MS`, `LOW_DISK_THRESHOLD_BYTES`, `BACKOFF_RETRY_MS`, and `MessageType` const object with all 17 LMUP message types.

- [ ] **Step 5: Create `src/enums.ts`**

Complete code from spec Section 3.3. Contains: `DeviceType`, `ConnectionState`, `UploadState`, `SidecarUploadStatus`, `DeviceDashboardStatus`, `ShareStatus`, `FileInitAction`, `SyncEngineState`, `MobileUploadItemStatus`.

- [ ] **Step 6: Create `src/types.ts`**

Complete code from spec Section 3.4. Contains all DTOs: `DiscoveredDeviceDTO`, `DashboardSummaryDTO`, `DashboardDeviceDTO`, `DeviceFileLedgerDTO`, `SettingsDTO`, `ShareStatusDTO`, `SyncSummaryDTO`, `ReadOnlyQueueItemDTO`, `BindingStateDTO`, `HistoryLedgerCardDTO`.

- [ ] **Step 7: Create `src/events.ts`**

Complete code from spec Section 3.5. Contains `SidecarEvent` discriminated union with 9 event types.

- [ ] **Step 8: Create `src/errors.ts`**

Complete code from spec Section 3.8. Contains `ErrorCode` const object with 12 error codes.

- [ ] **Step 9: Rewrite `src/index.ts` as barrel**

```typescript
export * from './protocol';
export * from './enums';
export * from './types';
export * from './events';
export * from './errors';
```

- [ ] **Step 10: Write test `src/__tests__/exports.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import * as contracts from '../index';

describe('@syncflow/contracts exports', () => {
  it('exports PROTOCOL_VERSION', () => {
    expect(contracts.PROTOCOL_VERSION).toBe('LMUP/2');
  });

  it('exports PROTOCOL_PORT', () => {
    expect(contracts.PROTOCOL_PORT).toBe(39393);
  });

  it('exports SIDECAR_HTTP_PORT', () => {
    expect(contracts.SIDECAR_HTTP_PORT).toBe(39394);
  });

  it('exports all MessageType values', () => {
    expect(contracts.MessageType.HELLO_REQ).toBe(0x0001);
    expect(contracts.MessageType.ERROR).toBe(0x0011);
    expect(Object.keys(contracts.MessageType)).toHaveLength(17);
  });

  it('exports all ErrorCode values', () => {
    expect(contracts.ErrorCode.PAIR_CODE_INVALID).toBe('PAIR_CODE_INVALID');
    expect(Object.keys(contracts.ErrorCode)).toHaveLength(12);
  });
});
```

- [ ] **Step 11: Run test to verify it passes**

```bash
pnpm install && pnpm --filter @syncflow/contracts build && pnpm --filter @syncflow/contracts test
```

Expected: all tests PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/contracts/
git commit -m "feat(contracts): add protocol, enums, types, events, errors modules"
```

---

### Task 0.2b 🔀 `@syncflow/design-tokens`

**Can run in parallel with T0.2a after T0.1.**

**Files:**
- Create: `packages/design-tokens/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/index.ts`, `src/colors.ts`, `src/radius.ts`, `src/elevation.ts`, `src/typography.ts`
- Create: `src/__tests__/tokens.test.ts`

**Source of truth:** Spec Section 4 + `tmp/ui-demo/app/globals.css`

- [ ] **Step 1: Create `package.json` + `tsconfig.json` + `vitest.config.ts`**

Same structure as contracts. Package name: `@syncflow/design-tokens`.

- [ ] **Step 2: Create `src/colors.ts`**

Complete code from spec Section 4.1 — all 35 OKLCH color tokens.

- [ ] **Step 3: Create `src/radius.ts`**

Complete code from spec Section 4.2 — base, sm, md, lg, xl, 2xl, 3xl, full.

- [ ] **Step 4: Create `src/elevation.ts`**

Complete code from spec Section 4.3 — `elevation` object (6 shadow presets) + `glass` object (5 glassmorphism presets).

- [ ] **Step 5: Create `src/typography.ts`**

Complete code from spec Section 4.4 — `fontFamily`, `fontSize`, `fontWeight`.

- [ ] **Step 6: Create `src/index.ts`**

```typescript
export * from './colors';
export * from './radius';
export * from './elevation';
export * from './typography';
```

- [ ] **Step 7: Write test `src/__tests__/tokens.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { colors } from '../colors';
import { radius } from '../radius';
import { elevation, glass } from '../elevation';
import { fontFamily } from '../typography';

describe('colors', () => {
  it('all values are valid oklch strings', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value).toMatch(/^oklch\(/);
    }
  });

  it('has primary color', () => {
    expect(colors.primary).toBe('oklch(0.60 0.16 245)');
  });
});

describe('radius', () => {
  it('has base radius', () => {
    expect(radius.base).toBe('0.75rem');
  });
});

describe('elevation', () => {
  it('has card shadow', () => {
    expect(elevation.card).toContain('rgba');
  });
});

describe('glass', () => {
  it('has card preset with background and blur', () => {
    expect(glass.card.background).toContain('rgba');
    expect(glass.card.blur).toBe('16px');
  });
});

describe('typography', () => {
  it('has Geist font family', () => {
    expect(fontFamily.sans).toContain('Geist');
  });
});
```

- [ ] **Step 8: Run test**

```bash
pnpm install && pnpm --filter @syncflow/design-tokens build && pnpm --filter @syncflow/design-tokens test
```

- [ ] **Step 9: Commit**

```bash
git add packages/design-tokens/
git commit -m "feat(design-tokens): add OKLCH colors, radius, elevation, typography"
```

---

### Task 0.3 🔁 Phase 0 Verification + Review

**Depends on: T0.1 + T0.2a + T0.2b all complete.**

- [ ] **Step 1: Full workspace validation**

```bash
pnpm install
pnpm turbo build
pnpm turbo test
pnpm turbo typecheck
```

All must pass with zero errors.

- [ ] **Step 2: Dispatch `code-reviewer` agent**

Review scope: all Phase 0 files. Criteria:
- Package boundaries correct
- TypeScript strict (no `any`)
- Exports match spec Section 3 + 4
- Tests meaningful (not just "exists")

- [ ] **Step 3: Fix review findings if any**

- [ ] **Step 4: Commit milestone**

```bash
git add -A
git commit -m "chore: Phase 0 complete — monorepo + contracts + design-tokens"
```

---

## Phase 1: Desktop Shell

### Task 1.0 🔁 Desktop Bootstrap

**Depends on: Phase 0 complete.**

**Files:**
- Create: `apps/desktop/package.json`, `electron-vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `components.json`, `postcss.config.mjs`, `electron-builder.yml`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/env.d.ts`, `src/renderer/styles/globals.css`, `src/renderer/lib/utils.ts`, `src/renderer/__tests__/setup.ts`

- [ ] **Step 1: Create `apps/desktop/package.json`**

```json
{
  "name": "@syncflow/desktop",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.web.json",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@syncflow/contracts": "workspace:*",
    "@syncflow/design-tokens": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0",
    "lucide-react": "^0.577.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^3.0.0",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "@electron-toolkit/preload": "^3.0.0",
    "@electron-toolkit/utils": "^3.0.0",
    "@tailwindcss/postcss": "^4.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.0.0",
    "electron": "^41.0.0",
    "electron-builder": "^26.8.0",
    "electron-vite": "^5.0.0",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.0",
    "tailwindcss": "^4.1.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: Create `electron-vite.config.ts`**

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
      },
    },
    plugins: [react()],
  },
});
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/__tests__/setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
});
```

- [ ] **Step 4: Create `src/renderer/__tests__/setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Create TypeScript configs**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "electron-vite.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "paths": {
      "@renderer/*": ["./src/renderer/*"]
    }
  },
  "include": ["src/renderer/**/*"]
}
```

- [ ] **Step 6: Create `postcss.config.mjs` + `components.json`**

`postcss.config.mjs`:
```javascript
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@renderer/components",
    "utils": "@renderer/lib/utils",
    "ui": "@renderer/components/ui",
    "lib": "@renderer/lib",
    "hooks": "@renderer/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 7: Create `src/renderer/styles/globals.css`**

Implement the CSS based on the OKLCH token values defined in spec Section 4 and the animation definitions. Use `tmp/ui-demo/app/globals.css` as visual reference only — the spec is the source of truth.

- [ ] **Step 8: Create `src/renderer/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Create minimal entry files**

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SyncFlow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/renderer/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(<App />);
```

`src/renderer/App.tsx`:
```tsx
export function App() {
  return <div className="flex h-screen items-center justify-center text-foreground">SyncFlow Desktop</div>;
}
```

`src/renderer/env.d.ts`:
```typescript
// Expanded by Task 1.1 with full ElectronAPI type declaration
export {};
```

- [ ] **Step 10: Create minimal main + preload**

`src/main/index.ts`: Migrate from `apps/desktop/electron-main/main.ts`, adapt paths for electron-vite. Use `is.dev` from `@electron-toolkit/utils` for dev URL detection.

`src/preload/index.ts`:
```typescript
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {});
```

- [ ] **Step 11: Create `electron-builder.yml`**

```yaml
appId: com.syncflow.desktop
productName: SyncFlow
mac:
  target:
    - dmg
    - zip
  category: public.app-category.utilities
directories:
  output: out
  buildResources: resources
```

- [ ] **Step 12: Install dependencies + shadcn components**

```bash
cd apps/desktop
pnpm install
npx shadcn@latest add button card badge dialog input separator scroll-area table tooltip select progress skeleton label sonner
```

- [ ] **Step 13: Verify `electron-vite dev`**

```bash
cd apps/desktop && pnpm dev
```

Expected: Electron window opens showing "SyncFlow Desktop" centered text.

- [ ] **Step 14: Commit**

```bash
git add apps/desktop/
git commit -m "feat(desktop): bootstrap electron-vite 5 + React 18 + shadcn + Tailwind v4"
```

---

### Task 1.1 🔀 Main Process + Preload

**Can run in parallel with T1.2, T1.3 after T1.0.**

**Files:**
- Create: `src/main/sidecar-manager.ts`, `src/main/ipc-handlers.ts`, `src/main/file-operations.ts`
- Expand: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/preload/api.d.ts`, update `src/renderer/env.d.ts`

- [ ] **Step 1: Create `src/main/sidecar-manager.ts`**

Stub class: `start()` logs "sidecar started (stub)", `stop()` logs, `healthCheck()` returns `Promise<{ ok: true }>`. Real implementation in Phase 3.

- [ ] **Step 2: Create `src/main/file-operations.ts`**

```typescript
import { shell, dialog } from 'electron';

export async function openFolder(path: string): Promise<void> {
  await shell.openPath(path);
}

export async function openFile(path: string): Promise<void> {
  await shell.openPath(path);
}

export async function selectFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0] ?? null;
}
```

- [ ] **Step 3: Create `src/main/ipc-handlers.ts`**

Define all IPC channel constants and register handlers. All sidecar handlers return mock data in Phase 1.

```typescript
import { ipcMain } from 'electron';
import { openFolder, openFile, selectFolder } from './file-operations';

// Channel constants — shared between main and preload
export const IPC = {
  SIDECAR_HEALTH:            'sidecar:health',
  SIDECAR_DASHBOARD_SUMMARY: 'sidecar:dashboard-summary',
  SIDECAR_DASHBOARD_DEVICES: 'sidecar:dashboard-devices',
  SIDECAR_DEVICE_DETAIL:     'sidecar:device-detail',
  SIDECAR_DEVICE_FILES:      'sidecar:device-files',
  SIDECAR_DEVICE_DATES:      'sidecar:device-dates',
  SIDECAR_SETTINGS:          'sidecar:settings',
  SIDECAR_UPDATE_SETTINGS:   'sidecar:update-settings',
  SIDECAR_REGENERATE_CODE:   'sidecar:regenerate-code',
  SIDECAR_SHARE_STATUS:      'sidecar:share-status',
  SIDECAR_VALIDATE_SHARE:    'sidecar:validate-share',
  FILES_OPEN_FOLDER:         'files:open-folder',
  FILES_OPEN_FILE:           'files:open-file',
  FILES_SELECT_FOLDER:       'files:select-folder',
  FILES_COPY_CLIPBOARD:    'files:copy-clipboard',
} as const;

export function registerIpcHandlers(): void {
  // Sidecar stubs — return mock data; replaced with real HTTP calls in Phase 3
  ipcMain.handle(IPC.SIDECAR_HEALTH, async () => ({ ok: true, service: 'syncflow-sidecar' }));
  ipcMain.handle(IPC.SIDECAR_DASHBOARD_SUMMARY, async () => ({ /* mock */ }));
  ipcMain.handle(IPC.SIDECAR_DASHBOARD_DEVICES, async () => ([]));
  ipcMain.handle(IPC.SIDECAR_DEVICE_DETAIL, async (_e, _deviceId: string) => ({}));
  ipcMain.handle(IPC.SIDECAR_DEVICE_FILES, async (_e, _deviceId: string, _date: string) => ([]));
  ipcMain.handle(IPC.SIDECAR_DEVICE_DATES, async (_e, _deviceId: string) => ({ dates: [] }));
  ipcMain.handle(IPC.SIDECAR_SETTINGS, async () => ({ /* mock */ }));
  ipcMain.handle(IPC.SIDECAR_UPDATE_SETTINGS, async (_e, _partial: Record<string, unknown>) => ({ /* mock */ }));
  ipcMain.handle(IPC.SIDECAR_REGENERATE_CODE, async () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    return { code };
  });
  ipcMain.handle(IPC.SIDECAR_SHARE_STATUS, async () => ({ enabled: false, smbUrl: null, status: 'unknown' }));
  ipcMain.handle(IPC.SIDECAR_VALIDATE_SHARE, async () => ({ enabled: false, smbUrl: null, status: 'unknown' }));

  // File operations
  ipcMain.handle(IPC.FILES_OPEN_FOLDER, async (_e, path: string) => openFolder(path));
  ipcMain.handle(IPC.FILES_OPEN_FILE, async (_e, path: string) => openFile(path));
  ipcMain.handle(IPC.FILES_SELECT_FOLDER, async () => selectFolder());

  ipcMain.handle(IPC.FILES_COPY_CLIPBOARD, async (_e, text: string) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
  });
}
```

The preload (Step 5) must use the same `IPC` constant strings. Import them or duplicate — if import doesn't work due to electron-vite isolation, copy the strings.

- [ ] **Step 4: Expand `src/main/index.ts`**

Import `registerIpcHandlers()`, create `SidecarManager`, call on app ready.

- [ ] **Step 5: Create `src/preload/index.ts` + `src/preload/api.d.ts`**

Expose full `electronAPI` via contextBridge matching spec Section 5.5. Type declaration for `ElectronAPI` interface.

- [ ] **Step 6: Update `src/renderer/env.d.ts`**

```typescript
import type { ElectronAPI } from '../preload/api';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/main/ apps/desktop/src/preload/ apps/desktop/src/renderer/env.d.ts
git commit -m "feat(desktop): main process IPC handlers + preload bridge"
```

---

### Task 1.2 🔀 Stores + Mocks + Helpers

**Can run in parallel with T1.1, T1.3 after T1.0.**

**Files:**
- Create: `src/renderer/mocks/devices.ts`, `mocks/dashboard.ts`, `mocks/files.ts`, `mocks/settings.ts`
- Create: `src/renderer/lib/format.ts`
- Create: `src/renderer/hooks/use-electron-api.ts`
- Create: `src/renderer/stores/app-store.ts`, `dashboard-store.ts`, `settings-store.ts`, `device-detail-store.ts`
- Create: `src/renderer/stores/__tests__/app-store.test.ts`, `dashboard-store.test.ts`, `settings-store.test.ts`, `device-detail-store.test.ts`

- [ ] **Step 1: Create mock data files**

Derive from `tmp/ui-demo/lib/mock-data.ts` but use `@syncflow/contracts` DTO types. Mocks must conform to `DashboardSummaryDTO`, `DashboardDeviceDTO[]`, `DeviceFileLedgerDTO[]`, `SettingsDTO`.

- [ ] **Step 2: Create `src/renderer/lib/format.ts`**

```typescript
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatDate(iso: string): string {
  return iso.slice(5).replace('-', '月') + '日';
}
```

- [ ] **Step 3: Create `src/renderer/hooks/use-electron-api.ts`**

Typed wrapper. Returns `window.electronAPI` if available, otherwise returns a mock fallback for browser dev mode.

- [ ] **Step 4: Create stores**

Implement all 4 stores matching spec Section 5.6 interfaces. Initialize from mock data. Key behaviors:
- `app-store`: view switching, modal open/close
- `dashboard-store`: device sorting (transferring > connected_idle > offline), warning dismiss
- `settings-store`: `updateSettings()` action, `setCopied()` tracking (code regeneration is NOT a store action — it's a preload call `regenerateConnectionCode()` that returns the new code, then store updates via `updateSettings`)
- `device-detail-store`: date selection, sort field/direction toggle

- [ ] **Step 5: Write store tests**

`app-store.test.ts`: view transitions, modal open/close/reopen
`dashboard-store.test.ts`: devices sorted correctly, dismiss warning
`settings-store.test.ts`: updateSettings merges partial, setCopied tracks field name
`device-detail-store.test.ts`: toggleSort flips direction, setDate updates files

- [ ] **Step 6: Run tests**

```bash
cd apps/desktop && pnpm test
```

Expected: all store tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/mocks/ apps/desktop/src/renderer/lib/ apps/desktop/src/renderer/hooks/ apps/desktop/src/renderer/stores/
git commit -m "feat(desktop): zustand stores + mock data + format helpers"
```

---

### Task 1.3 🔀 Layout + Shared Components

**Can run in parallel with T1.1, T1.2 after T1.0.**

**Files:**
- Create: `features/layout/Sidebar.tsx`, `features/layout/AppShell.tsx`
- Create: `components/shared/CopyButton.tsx`, `GlassCard.tsx`, `StatusBadge.tsx`, `FileIcon.tsx`
- Create: `components/shared/__tests__/shared.test.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create `Sidebar.tsx`**

Two nav items: 首页看板 (LayoutDashboard icon) + 全局设置 (Settings icon). Active highlight with white background + blue shadow. Glassmorphism sidebar. Logo at top. Reference: `tmp/ui-demo/components/pc/pc-app.tsx:29-93`.

- [ ] **Step 2: Create `AppShell.tsx`**

Layout: Sidebar (w-56) + content area. Background gradient: `linear-gradient(135deg, #daeef8 0%, #e8f5fb 40%, #f0f8fd 70%, #f8fbff 100%)`. Use `React.lazy()` + `Suspense` to load page components — this avoids hard import errors when T1.4a/b/c run in parallel:

```tsx
const Dashboard = lazy(() => import('@renderer/features/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const SettingsPage = lazy(() => import('@renderer/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const DeviceDetailModal = lazy(() => import('@renderer/features/device-detail/DeviceDetailModal').then(m => ({ default: m.DeviceDetailModal })));
```

During T1.3 (before pages exist), render fallback `<Skeleton />` in Suspense. Pages will resolve once T1.4a/b/c create the actual files.

- [ ] **Step 3: Create `GlassCard.tsx`**

```tsx
import { cn } from '@renderer/lib/utils';
import { glass, elevation } from '@syncflow/design-tokens';
import type { ReactNode } from 'react';

interface GlassCardProps {
  variant?: 'default' | 'muted' | 'modal';
  shadow?: keyof typeof elevation;
  className?: string;
  children: ReactNode;
}

export function GlassCard({ variant = 'default', shadow = 'card', className, children }: GlassCardProps) {
  const preset = glass[variant === 'muted' ? 'cardMuted' : variant === 'modal' ? 'modal' : 'card'];
  return (
    <div
      className={cn('rounded-2xl', className)}
      style={{
        background: preset.background,
        backdropFilter: `blur(${preset.blur})`,
        boxShadow: elevation[shadow],
        border: '1px solid rgba(255,255,255,0.85)',
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create `StatusBadge.tsx`**

Three variants: `transferring` (blue pulse dot + "传输中"), `connected_idle` (green dot + "已连接"), `offline` (gray dot + "未连接"). Use `cva` for variant styling.

- [ ] **Step 5: Create `CopyButton.tsx`**

Click → `navigator.clipboard.writeText` → show Check icon for 2s → revert to Copy icon. Props: `text: string`, `label?: string`.

- [ ] **Step 6: Create `FileIcon.tsx`**

Map file extension to icon + color. Video (mp4/mov/braw/mxf/r3d) = FileVideo blue, Image (jpg/heic/png/raw/dng) = Image cyan, Audio (wav/mp3/aac) = FileAudio purple, Other = File gray. Reference: `tmp/ui-demo/components/pc/device-detail-modal.tsx:33-46`.

- [ ] **Step 7: Write tests `components/shared/__tests__/shared.test.tsx`**

Test StatusBadge renders 3 variants with correct text, FileIcon maps `.mp4` to video icon, CopyButton calls clipboard API.

- [ ] **Step 8: Update `App.tsx`**

```tsx
import { AppShell } from '@renderer/features/layout/AppShell';

export function App() {
  return <AppShell />;
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/renderer/features/layout/ apps/desktop/src/renderer/components/shared/ apps/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): layout shell, sidebar, shared components"
```

---

### Task 1.4a 🔀 Dashboard Page

**Can run in parallel with T1.4b, T1.4c after T1.2 + T1.3.**

**Files:**
- Create: `features/dashboard/Dashboard.tsx`, `StatCard.tsx`, `DeviceCard.tsx`, `DiskWarningBanner.tsx`

**Reference:** `tmp/ui-demo/components/pc/dashboard.tsx`, spec Section 5.2

- [ ] **Step 1: Create `DiskWarningBanner.tsx`**

Red alert bar, dismissible X button. Text: "接收磁盘剩余空间 < 500MB，已暂停所有设备的接收任务". Shown when `isDiskLow && !diskWarningDismissed`.

- [ ] **Step 2: Create `StatCard.tsx`**

Props: `icon`, `iconGradient`, `label`, `value`, `unit?`. GlassCard wrapper. Three instances: files (blue gradient), space (purple), remaining (cyan).

- [ ] **Step 3: Create `DeviceCard.tsx`**

Device icon + name + IP + StatusBadge. If transferring: current filename + shadcn Progress bar + percentage. Footer: today file count + today size. Click → `openDeviceDetail()`. Offline: reduced opacity. Reference: `tmp/ui-demo/components/pc/dashboard.tsx:13-112`.

- [ ] **Step 4: Create `Dashboard.tsx`**

Compose: DiskWarningBanner + "所有设备" heading + StatCard × 3 + responsive DeviceCard grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`). Wire to dashboard-store.

- [ ] **Step 5: Verify visual**

```bash
cd apps/desktop && pnpm dev
```

Dashboard page renders with mock data, 3 stat cards, device grid, warning banner.

- [ ] **Step 6: Write smoke test `features/dashboard/__tests__/Dashboard.test.tsx`**

Render `<Dashboard />` with mock dashboard-store. Assert: 3 stat cards rendered, device cards rendered with expected count, warning banner visible when isDiskLow.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/features/dashboard/
git commit -m "feat(desktop): Dashboard page with stat cards and device grid"
```

---

### Task 1.4b 🔀 Settings Page

**Can run in parallel with T1.4a, T1.4c.**

**Files:**
- Create: `features/settings/SettingsPage.tsx`, `ConnectionCodeSection.tsx`, `FilePathSection.tsx`, `ShareAddressSection.tsx`, `SystemGuideSection.tsx`

**Reference:** `tmp/ui-demo/components/pc/settings-page.tsx`, spec Section 5.4

- [ ] **Step 1: Create `ConnectionCodeSection.tsx`**

6-digit display in individual boxes (secondary bg, rounded-xl, font-bold). CopyButton + "重新生成" button with RefreshCw icon. Wire to settings-store.

- [ ] **Step 2: Create `FilePathSection.tsx`**

shadcn Input showing path. Buttons: FolderOpen (select), Copy, open folder. Wire to `use-electron-api` for folder operations.

- [ ] **Step 3: Create `ShareAddressSection.tsx`**

Read-only display with Link2 icon + CopyButton. Show `smb://...` address from settings-store.

- [ ] **Step 4: Create `SystemGuideSection.tsx`**

Card: BookOpen icon + "Mac 开启本地共享操作手册" title + "适用于 macOS Ventura 及以上" subtitle.

- [ ] **Step 5: Create `SettingsPage.tsx`**

Compose all 4 sections with headings + descriptions. `max-w-2xl mx-auto px-6 py-8`.

- [ ] **Step 6: Write smoke test `features/settings/__tests__/SettingsPage.test.tsx`**

Render `<SettingsPage />`. Assert: 4 section headings visible ("连接码管理", "文件地址配置", "共享地址", "系统权限指引"), 6-digit code displayed.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/features/settings/
git commit -m "feat(desktop): Settings page with connection code and share config"
```

---

### Task 1.4c 🔀 Device Detail Modal

**Can run in parallel with T1.4a, T1.4b.**

**Files:**
- Create: `features/device-detail/DeviceDetailModal.tsx`, `DeviceHeader.tsx`, `DateFilter.tsx`, `StatsBar.tsx`, `FileLedgerTable.tsx`

**Reference:** `tmp/ui-demo/components/pc/device-detail-modal.tsx`, spec Section 5.3

- [ ] **Step 1: Create `DeviceHeader.tsx`**

Device icon (gradient bg) + name + IP + storage path + "打开文件夹" button + close X button.

- [ ] **Step 2: Create `DateFilter.tsx`**

shadcn Select populated from `availableDates`. Label: "今天 (03月21日)" format for today.

- [ ] **Step 3: Create `StatsBar.tsx`**

Three badges: `{N} 个文件` (FileVideo2 icon) + `{X} GB` (HardDrive icon) + `耗时 {H:MM:SS}` (Clock icon). Blue tinted background. Uses `formatBytes` + `formatDuration` from lib/format.

- [ ] **Step 4: Create `FileLedgerTable.tsx`**

shadcn Table with sortable column headers: filename (with FileIcon), size, completed time, created time, duration, action ("打开" button). Sort icons: ArrowUpDown / ArrowUp / ArrowDown. Wire to device-detail-store sort state.

- [ ] **Step 5: Create `DeviceDetailModal.tsx`**

shadcn Dialog wrapper. Compose: DeviceHeader + DateFilter + StatsBar + FileLedgerTable. Glassmorphism overlay. Wire to app-store `isModalOpen` + `selectedDevice`.

- [ ] **Step 6: Write smoke test `features/device-detail/__tests__/DeviceDetailModal.test.tsx`**

Render `<DeviceDetailModal />` with mock device + files. Assert: device name visible, file table renders rows, sort column headers clickable.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/features/device-detail/
git commit -m "feat(desktop): DeviceDetail modal with file ledger table"
```

---

### Task 1.5 🔁 Integration + Verification + Review

**Depends on: T1.1 + T1.2 + T1.3 + T1.4a + T1.4b + T1.4c all complete.**

- [ ] **Step 1: Visual verification**

Run `electron-vite dev`. Check all items:
- [ ] Sidebar: two nav items, click switches view, active highlight
- [ ] Dashboard: 3 stat cards with values, device grid sorted correctly
- [ ] Dashboard: disk warning shows and dismisses
- [ ] Dashboard: click device card → modal opens
- [ ] DeviceDetail: file table renders, columns sortable
- [ ] DeviceDetail: date filter switches data
- [ ] DeviceDetail: stats bar shows file count + size + duration
- [ ] Settings: 6-digit code displays, copy works, regenerate produces new code
- [ ] Settings: receive path displays, share address displays
- [ ] Settings: system guide card renders

- [ ] **Step 2: Run all tests**

```bash
pnpm turbo test
pnpm turbo typecheck
pnpm turbo lint
```

All pass.

- [ ] **Step 3: Build verification**

```bash
cd apps/desktop && pnpm build
```

electron-vite build completes without errors.

- [ ] **Step 4: Dispatch `code-reviewer` agent**

Review scope: entire `apps/desktop/`. Criteria:
- Component decomposition quality
- Consistent use of shadcn primitives
- Zustand store design (no unnecessary re-renders)
- TypeScript strictness (no `any`, proper types)
- Visual fidelity to ui-demo reference
- Test coverage gaps
- Import paths and package boundaries
- Accessibility basics (aria labels, keyboard nav)

- [ ] **Step 5: Fix review findings**

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 complete — Desktop shell with all pages and mock data"
```

---

## Verification Summary

### Phase 0 Gate

```bash
pnpm install                       # clean install
pnpm turbo build                   # contracts + tokens compile
pnpm turbo test                    # all package tests pass
pnpm turbo typecheck               # no TS errors
```

### Phase 1 Gate

```bash
pnpm turbo test                    # all tests pass (stores, shared components)
pnpm turbo typecheck               # no TS errors
pnpm turbo lint                    # no lint errors
cd apps/desktop && pnpm dev        # Electron window opens, all pages work
cd apps/desktop && pnpm build      # production build succeeds
```
