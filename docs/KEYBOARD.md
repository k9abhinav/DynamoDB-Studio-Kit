# Keyboard checklist

The shortcut dialog and the key handlers read `SHORTCUTS` in `apps/web/src/lib/hotkeys.ts`. This list is the manual audit. It was checked from the keyboard and the accessibility tree, not a live screen reader.

| Action                        | Keys                                 | Where                          | Checked by                             |
| ----------------------------- | ------------------------------------ | ------------------------------ | -------------------------------------- |
| Search                        | Ctrl K or ⌘K, including while typing | Anywhere                       | `e2e/shell.spec.ts`, `hotkeys.test.ts` |
| Keyboard shortcuts            | ?                                    | Anywhere, not while typing     | `e2e/shell.spec.ts`                    |
| Toggle sidebar                | [                                    | Anywhere, not while typing     | `hotkeys.test.ts`                      |
| Close                         | Esc                                  | Dialog, drawer, then selection | `e2e/shell.spec.ts`                    |
| Save item                     | Ctrl S or ⌘S                         | Item editor                    | `hotkeys.test.ts`                      |
| Format JSON                   | Ctrl Shift F or ⌘⇧F                  | Item editor                    | `hotkeys.test.ts`                      |
| Toggle JSON mode              | Alt M                                | Item editor                    | `hotkeys.test.ts`                      |
| Resize the drawer or a column | Arrow left or Arrow right            | Separator or column edge       | `hotkeys.test.ts`                      |
| Run query                     | Ctrl Enter or ⌘Enter                 | Query and PartiQL              | `hotkeys.test.ts`, `e2e/query.spec.ts` |
| Move between cells            | Arrow keys                           | Items grid                     | `e2e/shell.spec.ts`                    |
| First or last cell            | Home or End                          | Items grid                     | `hotkeys.test.ts`                      |
| Page through rows             | Page up or Page down                 | Items grid                     | `hotkeys.test.ts`                      |
| Select the row                | Space                                | Items grid                     | `hotkeys.test.ts`                      |
| Open the item                 | Enter                                | Items grid                     | `e2e/shell.spec.ts`                    |
| Clear the selection           | Esc                                  | Items grid                     | `hotkeys.test.ts`                      |

Command palette, after Search is open: Arrow up and Arrow down move the active row, Enter runs it, and a leading `>` lists actions only. `CommandPalette.test.tsx` covers Enter, `>theme`, `>density`, and switching a connection.

At 1280×800 and 200% zoom, Connect and Endpoint stay visible (`e2e/polish.spec.ts`). Run query and Edit stayed visible in the phase 6 and phase 5 checks.
