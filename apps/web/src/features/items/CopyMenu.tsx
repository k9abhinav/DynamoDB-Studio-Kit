import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { formatPlain, toPlainItem, type Item } from "@dynamo-studio/shared";
import { useState } from "react";
import { useOverlayStore } from "../../stores/overlay.js";
import { awsPutItemCommand } from "./copy-command.js";

export function CopyMenu(props: {
  item: Item;
  table: string;
  region: string;
  endpoint: string;
  disabled?: boolean;
}) {
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  async function copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    setAnchor(null);
    showSnackbar("Copied");
  }

  return (
    <>
      <Button
        disabled={props.disabled === true}
        startIcon={<ContentCopyOutlined />}
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
      >
        Copy
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
      >
        <MenuItem
          onClick={() => {
            void copy(formatPlain(toPlainItem(props.item)));
          }}
        >
          Plain JSON
        </MenuItem>
        <MenuItem
          onClick={() => {
            void copy(JSON.stringify(props.item, null, 2));
          }}
        >
          DynamoDB JSON
        </MenuItem>
        <MenuItem
          onClick={() => {
            void copy(
              awsPutItemCommand({
                table: props.table,
                region: props.region,
                endpoint: props.endpoint,
                item: props.item,
              }),
            );
          }}
        >
          AWS CLI
        </MenuItem>
      </Menu>
    </>
  );
}
