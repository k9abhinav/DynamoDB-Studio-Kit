# Phase 1: Design System and App Shell

**Goal:** The look and feel exists before any data does. MUI + Tailwind coexist cleanly, light/dark works, and the empty app shell (app bar, sidebar, tabs area, drawer area) is beautiful and accessible, running on mock data only.
**Specs:** 03-design-system (all), 02-architecture ADR-003/007, product APP-1..APP-6 (shell parts).
**Skills:** google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
- Theme (`theme.ts`) with light/dark color schemes, typography, shape, component overrides; tokens mirrored in `tokens.css` and Tailwind `@theme`. Choose the Phase 1 hex values marked in `03-design-system.md` (dark containers, `text-disabled`, `warning-text`) with the contrast test, then write those hex values back into that table.
- CSS layer setup (`@layer theme, base, mui, components, utilities`), `StyledEngineProvider enableCssLayer`, `GlobalStyles`, `CssBaseline`.
- Fonts via `@fontsource/roboto` and `roboto-mono` (only needed weights: 400/500/700).
- Providers: Theme, QueryClient, Router, Snackbar. Zustand `ui` store (theme mode, density, sidebar collapsed, drawer width), persisted to `localStorage`.
- Routing skeleton: `/` (connect, placeholder), `/c/:connId` (workspace), `/c/:connId/t/:table/:tab`, 404.
- Shell components built against **mock data**: `AppBar`, `SidebarTableList` (mock list), `TableTabs`, `ItemDrawer` (empty container), `EmptyState`, `ErrorState`, `ConfirmDialog` (+ typed variant), `Skeletons`, `CommandPalette` (opens, lists mock actions), `ShortcutHelpDialog`.
- A hidden dev route `/__design` showing every primitive in all states (light and dark) as living documentation. Not included in production build.
- Keyboard: `Cmd/Ctrl+K` palette, `?` shortcut dialog, `Esc` closes layers, `[` toggles sidebar.

## 2. Out of scope
Real API calls, real tables, the DataGrid (Phase 4), Monaco (Phase 5).

## 3. Functional requirements
- **FR-1.1** Theme mode toggle cycles Light / Dark / System, persisted; no flash of wrong theme on load (set `data-color-scheme` before React mounts via inline script in `index.html`).
- **FR-1.2** Density toggle (comfortable/compact) persisted; exposes CSS variable `--row-height`.
- **FR-1.3** Tailwind utilities override MUI predictably (demonstrated by a test component: `className="rounded-none"` on a MUI Card removes the radius without `!important`).
- **FR-1.4** App bar: logo/wordmark, command-palette search pill (opens palette), connection status chip (mock), theme toggle, overflow menu (About, Shortcuts).
- **FR-1.5** Sidebar collapses to a 72px rail with tooltips; state persists; auto-collapses below 1100px width.
- **FR-1.6** Drawer container supports resize (drag handle, keyboard arrows on handle, 420-720px), pushes content on >=1280px and overlays below.
- **FR-1.7** `/__design` page shows: buttons (all variants/states), text fields, select, chips, tabs, dialogs, snackbar with undo, skeletons, empty/error states, tooltips, tables of tokens (color swatches with contrast ratios).
- **FR-1.8** Focus ring is visible and consistent everywhere (2px primary, 2px offset).

## 4. Tasks
- [ ] T1.1 Tokens + MUI theme (light/dark) + Tailwind `@theme` + layer order + fonts
- [ ] T1.2 Providers, router skeleton, zustand ui store with persistence + tests
- [ ] T1.3 No-flash theme bootstrap script + ThemeToggle + tests
- [ ] T1.4 AppBar, StatusChip, EnvChip
- [ ] T1.5 Sidebar (list + rail mode) with mock data + search filter behavior
- [ ] T1.6 TableTabs shell, Tab persistence in URL
- [ ] T1.7 ItemDrawer container with resize + focus trap + tests
- [ ] T1.8 EmptyState, ErrorState (Details disclosure), Skeletons, ConfirmDialog (+ typed), Snackbar with Undo
- [ ] T1.9 CommandPalette + ShortcutHelpDialog + global hotkeys (`lib/hotkeys.ts`)
- [ ] T1.10 `/__design` gallery + contrast table generated from tokens
- [ ] T1.11 Playwright: screenshot light/dark of shell and gallery; axe scan of both
- [ ] T1.12 Progress + phase summary

## 5. Acceptance criteria
- **AC-1.1** Visual review: shell matches `03-design-system.md` section 4.2 (screenshots light+dark in `docs/screenshots/phase-1/`).
- **AC-1.2** Contrast: every token text/background pair meets AA (automated test over token table).
- **AC-1.3** Toggling theme never flashes the wrong theme on hard reload (Playwright test with throttled CPU).
- **AC-1.4** Tailwind-over-MUI override works with no `!important` anywhere (lint/grep check).
- **AC-1.5** Keyboard-only: can open palette, move through sidebar, open/close drawer, close dialogs; focus returns correctly (Playwright).
- **AC-1.6** axe: 0 serious/critical on `/__design` and shell in both themes.
- **AC-1.7** Initial JS (gzip) <= 150 KB for this phase (record in metrics log).
- **AC-1.8** `prefers-reduced-motion` removes non-opacity transitions (unit test of theme/transition helper).

## 6. Edge cases
Long table names truncate with tooltip; RTL not required but no hard-coded left/right where logical properties exist; very small viewport (1024px) still usable; 200% browser zoom.

## 7. Definition of done
Standard phase DoD plus: design gallery committed; screenshots committed.
