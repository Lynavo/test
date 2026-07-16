# README Beautification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beautify and modernize the main README.md and the Traditional Chinese translation README.zh-Hant.md.

**Architecture:** Update files directly in the repository. Use uniform flat-square badges, GitHub-specific markdown Alert formats, collapsible `<details>` blocks for verbose sections, and replace ASCII diagrams with high-fidelity Mermaid.js flowcharts.

**Tech Stack:** Markdown, Mermaid.js, Prettier.

---

### Task 1: Beautify English README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Apply markdown upgrades to README.md**

  Modify the `README.md` file using the following improvements:
  - Center-align the top branding: Banner, logo, title, description, and badges.
  - Upgrade badges to a uniform flat-square style.
  - Wrap the "Project Status" table in a clean description.
  - Render the visual diagram using a styled Mermaid flowchart showing the connection ports `39593` (LMUP/TCP) and `39594` (HTTP API).
  - Use GitHub-style `[!IMPORTANT]` and `[!WARNING]` alerts to emphasize OSS boundaries.
  - Group technical environment/setup commands under a single `🔧 Technical Infrastructure` heading.
  - Wrap the project directory structure map and development command references inside collapsible `<details>` blocks.
  - Keep the entire document strictly in English.

- [ ] **Step 2: Run formatting checks on the main README**

  Run: `pnpm format:check`
  Expected: Return success or format command pass.

- [ ] **Step 3: Commit the main README changes**

  Run:

  ```bash
  git add README.md
  git commit -m "docs: beautify and modernize main README.md"
  ```

---

### Task 2: Beautify Traditional Chinese README

**Files:**

- Modify: `README.zh-Hant.md`

- [ ] **Step 1: Apply markdown upgrades to README.zh-Hant.md**

  Modify the `README.zh-Hant.md` file using the exact same structural layout, Mermaid flowchart, collapsible `<details>` components, and Alert blocks as Task 1, translating any newly added English labels (like "Technical Infrastructure" and section names) into Traditional Chinese. Keep the entire document strictly in Traditional Chinese.

- [ ] **Step 2: Run formatting checks on the Traditional Chinese README**

  Run: `pnpm format:check`
  Expected: Return success or format command pass.

- [ ] **Step 3: Commit the Traditional Chinese README changes**

  Run:

  ```bash
  git add README.zh-Hant.md
  git commit -m "docs: beautify and synchronize Traditional Chinese README"
  ```

---

### Task 3: Full Validation & Verification

**Files:**

- Validate: `README.md`
- Validate: `README.zh-Hant.md`

- [ ] **Step 1: Check format validation for all modified files**

  Run: `pnpm format:check`
  Expected: PASS

- [ ] **Step 2: Verify git status is clean**

  Run: `git status`
  Expected: Working tree clean (all changes committed).
