import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import IconButton from "@mui/material/IconButton";
import { useOverlayStore } from "../../stores/overlay.js";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  return (
    <IconButton
      aria-label={label}
      size="small"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            showSnackbar("Copied.");
          },
          () => {
            showSnackbar("Could not copy.");
          },
        );
      }}
    >
      <ContentCopyOutlined fontSize="small" />
    </IconButton>
  );
}
