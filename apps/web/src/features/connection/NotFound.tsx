import SearchOffOutlined from "@mui/icons-material/SearchOffOutlined";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState.js";

export function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg">
      <EmptyState
        icon={<SearchOffOutlined className="text-[48px]" />}
        title="That page doesn't exist"
        help="Check the address, or go back to the connection screen."
        action={
          <Button component={Link} to="/" variant="contained">
            Back to connect
          </Button>
        }
      />
    </main>
  );
}
