# Screen reader notes

Checked with the accessibility tree in Playwright (roles and names), not a live screen reader.

## Items grid

- The grid is `role="grid"` with name "Items". `aria-rowcount` includes the header. `aria-colcount` includes the selection column.
- The header row is sticky. Each data column is a `columnheader`. The name is the attribute. Sorting is a button inside that header, and the button name is the attribute.
- The first column is selection. "Select all loaded items" and "Select row N" are checkboxes.
- A data cell's name is its visible text, including the type letter (for example "S SHIPPED"). Missing, Null, and Empty string cells use those words as the accessible name so they stay distinct from an id whose text is "null".
- Arrow keys move inside the grid. Enter opens the item. Escape clears the selection, and a second Escape (from the drawer hotkey) closes Item details and returns focus to the cell that opened it.
- "N items loaded" is a status live region. "Refreshing items" is the progress bar name while a page is loading.
