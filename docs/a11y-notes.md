# Screen reader notes

Checked with the accessibility tree in Playwright (roles and names), not a live screen reader.

## Items grid

- The grid is `role="grid"` with name "Items". `aria-rowcount` includes the header. `aria-colcount` includes the selection column.
- The header row is sticky. Each data column is a `columnheader`. The name is the attribute. Sorting is a button inside that header, and the button name is the attribute.
- The first column is selection. "Select all loaded items" and "Select row N" are checkboxes.
- A data cell's name is its visible text, including the type letter (for example "S SHIPPED"). Missing, Null, and Empty string cells use those words as the accessible name so they stay distinct from an id whose text is "null".
- Arrow keys move inside the grid. Enter opens the item. Escape clears the selection, and a second Escape (from the drawer hotkey) closes Item details and returns focus to the cell that opened it.
- "N items loaded" is a status live region. "Refreshing items" is the progress bar name while a page is loading.

## Item drawer

- The drawer is `role="dialog"` named "Item details". Escape closes it and returns focus to the grid cell that opened it.
- View mode shows the item in a `pre` named "Item JSON". The region is in the tab order so a large item can be scrolled from the keyboard.
- Edit, Duplicate, and Delete are buttons. On a read-only connection they are disabled and the tooltip is "This connection is read-only".
- Plain JSON and DynamoDB JSON are a pressed toggle group named "JSON mode". Save is disabled until the JSON is valid and different from the opened item.
- "Deleting items" exposes a progress bar named "Delete progress" and a Cancel button. A conflict is a dialog named "This item changed since you opened it".
- axe reported no serious or critical violations on the open drawer in light and dark. At 1280px wide and 200% zoom, Edit stays visible. This was checked from the accessibility tree, not a live screen reader.
