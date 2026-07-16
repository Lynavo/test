# README Beautification & Modernization Spec

This document outlines the design and plan for beautifying `README.md` and `README.zh-Hant.md` to present a modern, premium layout, clear technical information, and a high-fidelity Mermaid.js architecture diagram.

## Goals

1. **Modern Layout**: Enhance typography, use uniform badges, and structure sections using clear visual hierarchies.
2. **Interactive Diagrams**: Replace the text-based ASCII diagram with a dynamic Mermaid.js flowchart mapping mobile-desktop relationships and communications.
3. **Structured Collapse**: Wrap long logs, folder structures, and developer commands in `<details>` blocks to keep the page clean and scannable.
4. **Bilingual Sync**: Fully align `README.md` (English) and `README.zh-Hant.md` (Traditional Chinese) in terms of structure and updates.

## Technical Details

### 1. Badges & Header
- Align the headers, logos, and badges at the top center.
- Use uniform flat-square style shields for all badges:
  - OSS Release Gate: `https://github.com/lynavo/lynavo-drive/actions/workflows/oss-release-gate.yml/badge.svg`
  - Node.js: `>= 22.12.0` (green/blue logo)
  - Go: `>= 1.25.6` (00ADD8 logo)
  - Platform: macOS | Windows (lightgrey)
  - Mobile: iOS | Android (lightgrey)
  - License: MIT (green)

### 2. Architecture Diagram (Mermaid)
Replace ASCII with:
```mermaid
flowchart TD
    subgraph Mobile["📱 Mobile Client (iOS / Android)"]
        RN["React Native UI"]
        subgraph SE["Native Sync Engine"]
            iOS["iOS (Swift)"]
            Android["Android (Kotlin)"]
        end
    end

    subgraph Desktop["💻 Desktop App (macOS / Windows)"]
        Electron["Electron Shell (React 18 UI)"]
        Preload["Preload Bridge"]
        subgraph Sidecar["Go Sidecar"]
            HTTP["HTTP API & WebSockets (Port 39594)"]
            LMUP["LMUP Receiver (Port 39593)"]
            DB[("SQLite DB")]
            FS["Filesystem Shared Dirs"]
        end
    end

    %% Communication Links
    RN <--> Preload
    Preload <--> Electron
    Electron <--> HTTP
    
    %% Network Sync Channels
    SE -- "mDNS Discovery / Pairing" --> HTTP
    SE -- "Presence & Metadata (HTTP/WS)" --> HTTP
    SE -- "Incremental Media Sync (LMUP/TCP)" --> LMUP

    classDef mobile fill:#fff0f5,stroke:#db7093,stroke-width:1px;
    classDef desktop fill:#f0f8ff,stroke:#4682b4,stroke-width:1px;
    classDef sidecar fill:#f5fffa,stroke:#2e8b57,stroke-width:1px;
    class Mobile,RN,SE,iOS,Android mobile;
    class Desktop,Electron,Preload desktop;
    class Sidecar,HTTP,LMUP,DB,FS sidecar;
```

### 3. OSS Boundaries
Format the open-source gates using GitHub Alerts:
- `[!IMPORTANT]` for Local-LAN open-source core details.
- `[!WARNING]` for out-of-scope non-OSS boundaries (such as remote connection, cloud relay, store distribution, etc.).

### 4. Technical Infrastructure Section
Group the following sub-headings under a single unified section:
- **Prerequisites**
- **Tech Stack**
- **Common Commands**
- **Project Structure**
- **OSS Build & Package Verification**
Fold long listings (like commands, package verification, folder map) inside `<details>` blocks.

## Execution Checklist

- [ ] Update `README.md` (English only, no Chinese).
- [ ] Update `README.zh-Hant.md` (Traditional Chinese only).
- [ ] Verify formatting and markdown structure in both files.
- [ ] Run `pnpm format:check` to ensure no linting/formatting regression.
