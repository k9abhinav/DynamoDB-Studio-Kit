# UI states

Checklist for FR-8.1. Screenshots are in `docs/screenshots/phase-8/`. Loading flashes are covered by the route skeleton and the table/item skeletons; they are not frozen in a screenshot.

| Screen          | Loading                                              | Empty                                          | Error                                        | Success                                    | Light                                          | Dark                                         |
| --------------- | ---------------------------------------------------- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ---------------------------------------------- | -------------------------------------------- |
| Connect         | Route skeleton (`aria-label` Loading)                | DynamoDB Local hint when no saved connections  | Inline alert under the form                  | Test result alert, then the workspace      | `connect-light.png`, `connect-error-light.png` | `connect-dark.png`, `connect-error-dark.png` |
| Workspace       | Sidebar skeletons while tables load                  | Pick a table to get started                    | Connection lost banner with Retry            | Table list and status chip                 | `workspace-light.png`                          | `workspace-dark.png`                         |
| Items           | Grid skeletons, then a progress bar while refreshing | No items match / run a scan                    | ErrorState with Retry and Details            | Showing / scanned summary                  | `items-light.png`                              | `items-dark.png`                             |
| Query           | Same grid loading                                    | Run a query to load items                      | Same ErrorState                              | Result summary                             | `query-light.png`                              | `query-dark.png`                             |
| PartiQL         | Editor skeleton, then the grid                       | Run a statement to see items                   | Statement error in the panel                 | Results in the grid                        | `partiql-light.png`                            | `partiql-dark.png`                           |
| Overview        | Description skeleton                                 | New table with no items still shows the schema | ErrorState with Retry                        | Status, keys, approximate count            | `overview-light.png`                           | `overview-dark.png`                          |
| Indexes         | Same description skeleton                            | No global or local secondary indexes           | Same ErrorState                              | Index name, keys, status                   | `indexes-light.png`                            | `indexes-dark.png`                           |
| Item drawer     | Editor skeleton in edit mode                         | New item starts empty                          | Validation under the editor; conflict dialog | Snackbar, Undo when a previous item exists | `item-drawer-light.png`                        | `item-drawer-dark.png`                       |
| Create table    | Next stays disabled until the name is checked        | Wizard starts on Keys                          | Name already in use, inline                  | Navigates to the new overview              | `create-table-light.png`                       | `create-table-dark.png`                      |
| Import          | File step, then preview                              | No file chosen yet                             | Row errors and a downloadable report         | Done summary toast                         | `import-light.png`                             | `import-dark.png`                            |
| Export          | Progress toast while reading                         | No rows yet still offers the format            | Failure toast                                | Download starts                            | `export-light.png`                             | `export-dark.png`                            |
| Command palette | Opens immediately                                    | No matches leaves the list empty               | —                                            | Runs the selected command                  | `palette-light.png`                            | `palette-dark.png`                           |
| Shortcuts       | Opens immediately                                    | —                                              | —                                            | Lists the shared shortcut map              | `shortcuts-light.png`                          | `shortcuts-dark.png`                         |
| About           | Opens immediately                                    | —                                              | —                                            | Version line                               | `about-light.png`                              | `about-dark.png`                             |
| Not found       | —                                                    | That page doesn't exist                        | —                                            | Back to connect                            | `not-found-light.png`                          | `not-found-dark.png`                         |

## Audit notes (2026-10-31)

Fixed against `specs/03-design-system.md`:

- The endpoint field is a pill with the placeholder `http://localhost:8000`. A floating label sat inside the rounded cap.
- Alerts use the outlined variant.
- The route fallback is skeleton rows, still named Loading.
- Saved connections are loaded after `GET /api/v1/session`, so a first visit is an empty list instead of "Couldn't load saved connections."
- The DynamoDB Local hint is an outlined info alert, shown only when that list is empty, and dismissed into `ds-local-hint-dismissed`.
- More options uses a disclosure chevron. The read-only switch label is "Read-only".

The command palette ranks recent tables and actions first, and a leading `>` lists actions only. The shortcut dialog reads the same `SHORTCUTS` list the hotkey matcher uses. Route error boundaries and the offline banner are the next tasks in this phase. They are not finished screens yet.
