# 03. Design System: "Google-minimal"

Goal: it should feel like a native Google tool (think Google Cloud Console's cleaner siblings, Drive, Gmail, Keep):
calm, white, precise, friendly. Material Design 3 *spirit*, implemented with MUI + Tailwind.

> Do not bundle **Google Sans** (proprietary). Use **Roboto** for UI and **Roboto Mono** for data/code.

## 1. Principles
1. **Quiet UI, loud data.** Chrome fades back; the user's data is the hero.
2. **One accent.** Google Blue for primary actions and focus. Everything else is neutral.
3. **Borders over shadows.** 1px outline separates surfaces. Shadows only for floating layers (menus, dialogs, drawers).
4. **Generous but efficient space.** 4px grid. Comfortable by default, compact optional.
5. **Motion is feedback, not decoration.** 150-250ms, standard easing. Respect reduced motion.
6. **Obvious primary action per screen.** Pill buttons for primary, text buttons for secondary.

## 2. Tokens

### 2.1 Color (light)
| Token | Hex | Use |
|---|---|---|
| `primary` | `#1967D2` | primary buttons, links, focus ring, selected. `#1A73E8` is 4.27:1 on `bg` and 3.93:1 on `primary-container`, so Phase 1 uses Google Blue 700 |
| `primary-container` | `#E8F0FE` | selected rows, chips, hover tint |
| `on-primary` | `#FFFFFF` | |
| `bg` | `#F8F9FA` | app background |
| `surface` | `#FFFFFF` | cards, panels, grid |
| `surface-variant` | `#F1F3F4` | hover, table header, code background |
| `outline` | `#DADCE0` | borders, dividers |
| `text-primary` | `#202124` | |
| `text-secondary` | `#5F6368` | |
| `text-disabled` | `#727272` | AA on `bg` and `surface`. `#9AA0A6` is 2.5:1, so Phase 1 replaced it |
| `error` | `#D93025` | errors, destructive |
| `error-container` | `#FCE8E6` | |
| `success` | `#1E8E3E` | |
| `success-container` | `#E6F4EA` | |
| `warning` | `#F9AB00` | fill and the Staging dot. Text on this fill uses `#202124` |
| `warning-container` | `#FEF7E0` | |
| `warning-text` | `#8A5A00` | body text on `bg` and `surface`. Do not use `#F9AB00` as body text |

### 2.2 Color (dark)
| Token | Hex |
|---|---|
| `primary` | `#8AB4F8` |
| `primary-container` | `#1F3A5F` (tinted) |
| `on-primary` | `#062E6F` |
| `bg` | `#202124` |
| `surface` | `#292A2D` |
| `surface-variant` | `#35363A` |
| `outline` | `#3C4043` |
| `text-primary` | `#E8EAED` |
| `text-secondary` | `#9AA0A6` |
| `error` | `#F28B82` |
| `error-container` | `#5C2B29` |
| `success` | `#81C995` |
| `success-container` | `#16352A` |
| `warning` | `#FDD663` |
| `warning-container` | `#3E2E00` |
| `warning-text` | `#F6C343` |
| `text-disabled` | `#9AA0A6` |

`#F9AB00` and `#FDD663` are fills and dots. Body text on `bg` or `surface` uses `warning-text`. Phase 1 chose the container, `warning-text`, and dark `text-disabled` hex values with the contrast test. Light `text-disabled` moved from `#9AA0A6` to `#727272` because `#9AA0A6` is 2.5:1 on white.

Verify contrast for every text/background pair >= 4.5:1 (body) and >= 3:1 (large text, UI boundaries). Pairs that must pass: `text-primary` and `text-secondary` on `bg`, `surface`, and `surface-variant`; `primary` on `bg`, `surface`, `surface-variant`, and `primary-container`; `on-primary` on `primary`; `warning-text` on `bg` and `surface`; `text-disabled` on `bg` and `surface`; text placed on `error-container`, `success-container`, and `warning-container`.

### 2.3 Environment tag colors (dots/chips only)
Local `#5F6368` (gray) · Dev `#1A73E8` (blue) · Staging `#F9AB00` (amber) · **Production `#D93025` (red)**.

### 2.4 Type scale (Roboto)
| Role | Size/Line | Weight |
|---|---|---|
| Display (connect title) | 28/36 | 400 |
| Title | 22/28 | 400 |
| Subtitle | 16/24 | 500 |
| Body | 14/20 | 400 |
| Caption | 12/16 | 400 |
| Mono (data) | 13/20 | 400 (Roboto Mono) |
Letter-spacing 0 (Roboto default). Sentence case everywhere (never ALL CAPS buttons).

### 2.5 Shape and elevation
- Radius: input/chip **8px**; card/panel **12px**; dialog **16px**; primary/secondary buttons and search fields **999px (pill)**; grid has **0** radius inside a 12px bordered container.
- Elevation: level 0 (borders only) by default. Level 1 `0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)` for menus/popovers. Level 2 for dialogs/drawers `0 2px 6px 2px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.3)`.

### 2.6 Spacing and sizing
- Base unit 4px. Common: 8, 12, 16, 24, 32.
- App bar height 56px (64px on >=1280). Sidebar 280px (collapsible to 72px rail). Details drawer 420px (resizable up to 720px).
- Row height: comfortable **48px**, compact **32px**. Min touch/click target **32px** (visually smaller icon buttons still get 32px hit area).
- Focus ring: 2px `primary` outline, 2px offset, on all interactive elements (never removed).

### 2.7 Motion
- Easing standard `cubic-bezier(0.2, 0, 0, 1)`; durations 150ms (hover, chip), 200ms (drawer/dialog), 250ms (page/route). Skeleton shimmer 1.2s. `@media (prefers-reduced-motion: reduce)` -> no transitions beyond opacity.

## 3. Implementation rules (MUI + Tailwind)
1. Theme tokens defined once in `apps/web/src/app/theme.ts` via `createTheme` with `colorSchemes: { light, dark }` and `cssVariables: { colorSchemeSelector: '[data-color-scheme="%s"]' }`. Mirror them in `styles/tokens.css` for Tailwind `@theme`. An inline script in `index.html` sets `data-color-scheme` before React mounts, using the `mui-mode` storage key, so the first paint matches the saved mode.
2. Use MUI components for: Button, IconButton, TextField, Select/Autocomplete, Dialog, Drawer, Menu, Tabs, Tooltip, Chip, Switch, Checkbox, Snackbar, Skeleton, CircularProgress/LinearProgress, ToggleButtonGroup.
3. Use Tailwind for: layout (`flex`, `grid`, `gap-*`, `min-w-0`), spacing, sizing, overflow/truncate, responsive, positioning. Prefer token utilities (`bg-surface`, `text-secondary`, `border-outline`).
4. MUI component overrides are made in the theme (`components: {...}`), not scattered `sx` props. `sx` allowed only for one-off dynamic values.
5. No inline `style={{}}` except for truly dynamic numeric values (virtualizer offsets, resize widths).
6. Icons: `@mui/icons-material` **Outlined** variants only, 20px in dense UI, 24px elsewhere.
7. No gradients, no heavy illustrations, no emoji in UI chrome. The one allowed flourish: a subtle radial tint behind the connect card.

## 4. Layout

### 4.1 Connect screen
```
┌──────────────────────────────────────────────────────────────┐
│                                              [☾ theme]       │
│                                                              │
│                  ┌──────────────────────────┐                │
│                  │   ◈  DynamoDB Studio     │                │
│                  │   Connect to a database  │                │
│                  │                          │                │
│                  │ ( http://localhost:8000 ) │  <- pill field, autofocus
│                  │  Region [ us-east-1  ▾ ] │                │
│                  │  Auth   (•) Local ( ) Key│                │
│                  │         ( ) Profile ( )..│                │
│                  │  ▸ More options          │  <- name, env tag, read-only, remember
│                  │                          │                │
│                  │  [ Test ]    [ Connect ] │  <- Connect = filled pill
│                  └──────────────────────────┘                │
│                                                              │
│   Recent                                                     │
│   ● Local dev   localhost:8000   2 min ago      ⋮            │
│   ● Staging     us-east-1        yesterday      ⋮            │
└──────────────────────────────────────────────────────────────┘
```
- Card width 480px, centered, 12px radius, 1px outline, padding 32px. Background `bg` with a faint radial `primary-container` tint at top.
- Enter submits. Errors render inline under the relevant field or as an inline alert at the card's bottom (never a toast).
- On success: card fades/scales out (200ms), workspace fades in.

### 4.2 Workspace
```
┌───────────────────────────────────────────────────────────────────────────┐
│ ☰  ◈ DynamoDB Studio   ( 🔍 Search tables, actions  ⌘K )   ● Local · 12ms  ◐  ⋮ │  App bar
├────────────┬──────────────────────────────────────────────┬───────────────┤
│ Tables  ⟳  │ users ✕ │ orders ✕ │ +                         │               │ Tabs
│ (🔍 filter)│ ───────────────────────────────────────────  │  Item details │
│ ▸ users    │ [Items] [PartiQL] [Overview] [Indexes]        │  (drawer)     │
│   orders   │ ( Scan | Query )  [+ Filter] [Columns] [⋯]    │  View | Edit  │
│   sessions │ ┌─────────────────────────────────────────┐   │  { JSON }     │
│            │ │ 🔑id   │ name  │ email │ createdAt │ ...│   │               │
│            │ │ ...    │       │       │           │    │   │  [Save]       │
│            │ └─────────────────────────────────────────┘   │               │
│ + New table│ Showing 50 · Scanned 50 · 6.5 RCU   [Load more]│               │
└────────────┴──────────────────────────────────────────────┴───────────────┘
```
- Tabs are Items, PartiQL, Overview, and Indexes. Scan | Query is a segmented control on the Items tab.
- Sidebar is a calm list: no icons per row except a small table glyph; selected row uses `primary-container` with `primary` text and a 3px left indicator.
- Toolbar items are text/icon buttons; only one filled button at a time (e.g. "Create item").
- Drawer pushes content on >=1280px, overlays below.

## 5. Components checklist (each needs: default, hover, focus, active, disabled, loading, error where relevant)
`ConnectCard`, `ConnectionListItem`, `EnvChip`, `StatusChip`, `AppBar`, `SidebarTableList`, `TableTabs`, `SegmentedToggle`, `FilterChip`, `FilterBuilderPopover`, `DataGrid` (+ `CellRenderer`, `TypeBadge`, `ColumnChooser`, `DensityToggle`), `ResultSummaryBar`, `ItemDrawer`, `JsonEditor`, `ModeToggle (DynamoDB JSON / Plain JSON)`, `ConfirmDialog` (+ typed confirm variant), `EmptyState`, `ErrorState` (message + Details disclosure + Retry), `Skeletons`, `CommandPalette`, `ShortcutHelpDialog`, `QueryBuilder`, `PartiQLEditor`, `CreateTableWizard`, `ImportWizard`, `ExportDialog`, `ProgressToast`.

## 6. States and copy
- **Loading:** skeletons shaped like the final content (rows, list items). Never a lone spinner for > 300ms regions. Linear progress at the top of a panel for refetch.
- **Empty:** icon (outlined, 48px, `text-disabled`) + one-line title + one-line help + one primary action.
- **Error:** inline `Alert` (outlined variant) with plain message, **Retry**, and a "Details" disclosure holding AWS error code/request id.
- **Success:** Snackbar bottom-left (Google style), optional **Undo**. It stays 4 seconds when there is no Undo. When Undo is available, it stays until the user activates Undo, dismisses it, or 30 seconds pass.
- **Destructive:** red text button in dialog (`Delete 12 items`), not red filled until the final confirm; typed-confirmation field for Production.

## 7. Accessibility
Keyboard map documented in the shortcut dialog; grid is a `role="grid"` with roving tabindex and arrow-key navigation; drawers trap focus and return it on close; dialogs have labelled titles; live region announces load results ("50 items loaded"); axe 0 serious/critical in both themes.

## 8. Do / Don't
| Do | Don't |
|---|---|
| White surfaces, 1px borders | Drop shadows on every card |
| Single blue accent | Multiple saturated colors |
| Sentence case labels | ALL CAPS buttons |
| Pill primary action | Square heavy buttons |
| Subtle hover tint (`surface-variant`) | Bold hover color changes |
| Skeletons matching layout | Full-screen spinners |
| Inline errors with fixes | Raw error codes as the headline |
