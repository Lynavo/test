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

### 5. Community & Social Shields

- Replace text links in the "Community & Social" (or "社群與社群媒體") section with modern flat-square brand badges:
  - X: `[![X](https://img.shields.io/badge/X-%23000000?style=flat-square&logo=x&logoColor=white)](https://x.com/founder_im63606)`
  - Mastodon: `[![Mastodon](https://img.shields.io/badge/Mastodon-%236364FF?style=flat-square&logo=mastodon&logoColor=white)](https://mastodon.social/@ViviDrop)`
  - Bluesky: `[![Bluesky](https://img.shields.io/badge/Bluesky-%230085FF?style=flat-square&logo=bluesky&logoColor=white)](https://bsky.app/profile/vividrop.bsky.social)`
  - LinkedIn: `[![LinkedIn](https://img.shields.io/badge/LinkedIn-%230077B5?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lynavo-lynavo-1273322b6/)`
  - YouTube: `[![YouTube](https://img.shields.io/badge/YouTube-%23FF0000?style=flat-square&logo=youtube&logoColor=white)](https://www.youtube.com/channel/UCMcYmWmPMzQ5N8bHFffnldQ)`

### 6. License Removal

- Note that the "License" and "授權條款" sections have been explicitly removed.

## Execution Checklist

- [ ] Update `README.md` (English only, no Chinese) to add community shields and ensure no License section.
- [ ] Update `README.zh-Hant.md` (Traditional Chinese only) to add community shields and ensure no License section.
- [ ] Verify formatting and markdown structure in both files.
- [ ] Run `pnpm format:check` to ensure no linting/formatting regression.
