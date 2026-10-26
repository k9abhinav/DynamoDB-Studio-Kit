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

## Query builder

- Scan and Query are a toggle group named "Read mode". Keep filters is a checkbox. Page size stays available in both modes.
- The query form fields are Target, the partition-key name, a sort-key checkbox, Operator, Value, And value, Sort order, Consistent read, and Projection. Run query is the submit button. An empty partition key disables it.
- Consistent read on a global secondary index is disabled. The tooltip is "Consistent read is not available on a global secondary index."
- Show request is a disclosure. The tabs are the request JSON and AWS CLI. Copy request copies the visible tab.
- Before a query runs, the grid area says "Run a query to load items."
- axe reported no serious or critical violations on the query view in light and dark. At 1280px wide and 200% zoom, Run query stays visible. This was the accessibility tree, not a live screen reader.

## PartiQL

- Run, Stop, Templates, History, and Save query are buttons. Stop stays disabled until a statement is fetching. Add parameter adds a field named "Parameter N (S)".
- The statement area is the Monaco editor. A syntax error that includes a position marks that line and column.
- History opens a drawer with headings History and Saved queries, a Clear history button, and a Search saved queries field.
- A mutation opens a dialog titled with the verb, such as "UPDATE statement". The confirm button is "Run statement". A production connection asks for the quoted table name.
- The results use the same Items grid. An empty run says "Run a statement to see items."
- axe reported no serious or critical violations on the PartiQL view in light and dark. This was the accessibility tree, not a live screen reader.
