---
name: google-minimal-ui
description: Build UI for DynamoDB Studio in a Google-style minimal look using React + MUI + Tailwind v4. Use for any component, screen, theme, layout, copy, animation, or accessibility work. Enforces design tokens, MUI/Tailwind division of labor, states, and a11y.
---

# Google-minimal UI (MUI + Tailwind)

Source of truth for tokens and layouts: `specs/03-design-system.md`. This skill is the **how-to**.

## 1. Mental model
- **Quiet chrome, loud data.** White surfaces, 1px `outline` borders, one blue accent. If you reach for a shadow, gradient, or second accent color, stop.
- **MUI = behavior and a11y** (components). **Tailwind = layout** (flex/grid/gap/spacing/truncate/responsive). **Theme = single source of tokens.**
- Sentence case. Pill primary buttons. Outlined icons. Friendly short copy.

## 2. Setup snippets (reference; implement in Phase 1)

**`apps/web/src/styles/index.css`**
```css
@layer theme, base, mui, components, utilities;
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-primary: var(--ds-primary);
  --color-primary-container: var(--ds-primary-container);
  --color-bg: var(--ds-bg);
  --color-surface: var(--ds-surface);
  --color-surface-variant: var(--ds-surface-variant);
  --color-outline: var(--ds-outline);
  --color-text: var(--ds-text-primary);
  --color-text-secondary: var(--ds-text-secondary);
  --color-error: var(--ds-error);
  --color-success: var(--ds-success);
  --color-warning: var(--ds-warning);
  --font-sans: "Roboto", system-ui, sans-serif;
  --font-mono: "Roboto Mono", ui-monospace, monospace;
}
```

**Provider order (`app/providers.tsx`)**
```tsx
<StyledEngineProvider enableCssLayer>
  <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
  <ThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
    <CssBaseline />
    {children}
  </ThemeProvider>
</StyledEngineProvider>
```

**Theme skeleton (`app/theme.ts`)**: use `createTheme({ cssVariables: { colorSchemeSelector: 'data-color-scheme' }, colorSchemes: { light: {...}, dark: {...} }, shape: { borderRadius: 8 }, typography: { fontFamily, button: { textTransform: 'none', fontWeight: 500 } }, components: { MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 999 } } }, ... } })`. Keep the exact hex values from the design spec. Check the MUI docs (via web search or `context7` if available) for the current API of the installed MUI version before coding: APIs for CSS variables/color schemes have changed across versions.

## 3. Division of labor
| Need | Use |
|---|---|
| Button, IconButton, TextField, Select, Autocomplete, Dialog, Drawer, Menu, Tabs, Tooltip, Chip, Switch, Checkbox, Snackbar, Skeleton, Progress | **MUI** (themed in `theme.ts`) |
| Page/section layout, flex/grid, gap, padding/margin, width/height, truncation, overflow, responsive, sticky | **Tailwind** utilities |
| Colors | token utilities `bg-surface text-text-secondary border-outline` (never hex literals) |
| One-off dynamic numbers (virtualizer offsets, resize width) | inline `style` allowed |
| MUI internals | theme `components` overrides. **Not** `sx` sprinkled everywhere, **not** Tailwind arbitrary child selectors |
Never use `!important`. If a Tailwind class doesn't win over MUI, fix the layer order, not the specificity.

## 4. Component recipes

**Primary action:** `<Button variant="contained" size="medium">Connect</Button>` (pill via theme). One filled button per view.
**Secondary:** `variant="text"` or `outlined` (outlined only on cards/dialogs where contrast helps).
**Search field (pill):** MUI `TextField` with `slotProps.input.sx` radius 999 via theme variant `search`; leading outlined `Search` icon; `Esc` clears.
**Chip (filters):** `Chip` `variant="outlined"` with delete icon; selected state uses `primary-container` background + `primary` text.
**Card/panel:** `<div className="rounded-xl border border-outline bg-surface">` (no shadow). Header `px-4 py-3 border-b border-outline`.
**List item (sidebar):** 40px tall, `px-3`, selected: `bg-primary-container text-primary` + 3px left bar; hover: `bg-surface-variant`.
**Dialog:** MUI `Dialog` radius 16, title 22/28, actions right-aligned, destructive confirm is a **text button in error color** until typed confirmation is satisfied, then a filled error button.
**Snackbar:** bottom-left, dark surface (`#323232` light / `#E8EAED` on dark inverse), optional action `Undo`. 4 seconds when there is no Undo. When Undo is available, it stays until Undo, dismiss, or 30 seconds.
**Empty state:** 48px outlined icon `text-disabled`, title (Subtitle), help (Body secondary), one primary action.
**Error state:** `Alert variant="outlined" severity="error"` + `Retry` + collapsible `Details` (AWS code, request id) with mono font.
**Skeletons:** same dimensions as real content; `animation="wave"`; reduced-motion -> static.
**Data grid cells:** mono 13px for values, `TypeBadge` 10px uppercase **only** for the type letters (S, N, B, BOOL, NULL, L, M, SS, NS, BS) in a tiny rounded `surface-variant` chip: the single place uppercase is allowed.

## 5. Layout rules
- App bar 56/64px, sidebar 280px (rail 72px), drawer 420-720px, content fluid. Use CSS grid on the shell: `grid-cols-[auto_1fr_auto]`; set `min-w-0` on flex/grid children that contain tables or editors to prevent overflow.
- 4px spacing grid (Tailwind spacing scale already matches: `p-1`=4px...). Prefer 8/12/16/24.
- Content max readable width for forms (connect card 480px, wizards 640px).
- Sticky headers/toolbars use `bg-surface` + bottom border (no shadow).

## 6. Motion
`transition-colors duration-150`, drawers/dialogs 200ms, route fade 250ms, easing `cubic-bezier(0.2,0,0,1)`. Wrap non-essential motion in `motion-safe:`. No bouncy springs, no parallax.

## 7. Copy (UX writing)
- Say what happened + what to do next. Example errors: "Couldn't reach http://localhost:8000. Is DynamoDB running and the URL correct?"
- Buttons are verbs: Connect, Save, Delete 12 items, Load more. No "OK"/"Submit".
- Confirmations name the object and count: "Delete 12 items from orders?" Explain irreversibility once.
- No exclamation marks except real celebrations (there are none in v1). No emojis in UI chrome.
- Empty states invite action; never blame the user.
- Tooltips explain *why* something is disabled ("This connection is read-only").

## 8. Accessibility checklist (per component)
- Every interactive element has an accessible name (visible label, `aria-label`, or `aria-labelledby`).
- Keyboard: Tab order logical; Enter/Space activate; Esc closes layers; arrow keys in lists/grids/menus/tabs.
- Focus visible (2px primary, offset 2px). Dialog/drawer trap focus and **restore focus** to the trigger.
- Contrast >= 4.5:1 text, >= 3:1 UI boundaries in **both** themes. Never color-only meaning (add icon/text).
- Live regions (`aria-live="polite"`) for async results ("50 items loaded", "Item saved").
- Grid: `role="grid"`, `aria-rowcount`, `aria-colcount`, roving tabindex.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Hit targets >= 32px.

## 9. Review prompts (self-check before showing work)
1. Could I delete a border, shadow, or color and lose nothing? Delete it.
2. Is there exactly one primary action on screen?
3. Does dark mode look *designed*, not inverted?
4. Do loading, empty, error states exist and look intentional?
5. Can I do everything with the keyboard?
6. Does the copy tell the user what to do next?
7. Are there any hex colors, inline styles, or `!important` in the diff? Remove them.

## 10. Anti-patterns (reject in review)
Heavy drop shadows; gradients; ALL-CAPS buttons; multiple accent colors; full-screen spinners; modal-on-modal; toasts for form errors; raw AWS error codes as headlines; tiny 11px body text; horizontal page scroll at 1024px; icon-only buttons without tooltips/labels; truncated text without tooltip.
