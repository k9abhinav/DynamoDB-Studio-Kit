# User guide

## Connect

Open the app. Paste the DynamoDB endpoint. `localhost:8000` is treated as local: the region stays `us-east-1` and auth stays **Local**. Real AWS URLs fill the region from the hostname.

Choose an auth method when you are not on DynamoDB Local:

- **Access key** asks for an access key id, secret, and optional session token.
- **Profile** uses a named profile from your AWS config.
- **Default chain** uses the environment, a role, or other SDK defaults.

**Read-only** blocks writes on the server. **Remember this connection** stores the profile on disk. **Connect** opens the workspace. A failure names the endpoint and says what to check.

## Browse

The sidebar lists tables. Search filters that list. Select a table to open its items. The grid shows a page of items, with keys pinned first. **Add filter** narrows the loaded page. **Query** requires the partition key and can use a sort key. Open a row to see the item, then **Copy** and choose **Plain JSON** or **DynamoDB JSON**.

## Edit

Choose **Edit**. Plain JSON is the friendly form. DynamoDB JSON is the lossless wire form. Invalid JSON, a missing key, or a changed key is shown next to the editor and **Save** stays disabled. **Save** writes the item. A snackbar offers **Undo**, which puts the previous item back when the studio still has it.

If another writer changed the item, the studio asks you to reload or overwrite. That check is best-effort. See the architecture note.

## PartiQL

Open the **PartiQL** tab. The editor highlights the statement. **Run** (or Ctrl/Cmd+Enter) shows results in the same grid. Insert, update, and delete ask you to confirm. **Save query** stores a name locally for this connection. **History** lists recent statements.

## Tables, import, and export

**Create table** walks through the name, keys, an optional GSI, and a TTL attribute. **Table actions** includes import, export, clear, and delete. Import shows a preview before it writes. Export can be JSON, NDJSON, or CSV for the current view or the whole table. Deleting a table asks you to type its name. A connection tagged production asks for the same kind of typed confirmation on destructive actions.

## Shortcuts

Press `?` for the shortcut list. The command palette opens with Ctrl/Cmd+K. A leading `>` shows actions only.
