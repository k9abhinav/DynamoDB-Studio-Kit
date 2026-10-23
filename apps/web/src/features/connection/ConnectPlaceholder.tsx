import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../../components/ThemeToggle.js";

export function ConnectPlaceholder() {
  return (
    <div className="connect-backdrop relative grid min-h-dvh place-items-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-[480px] rounded-xl border border-outline bg-surface p-8">
        <h1 className="text-[28px] leading-9 font-normal">DynamoDB Studio</h1>
        <p className="mt-2 text-sm text-text-secondary">Connect to a database</p>
        <Button component={Link} to="/c/local/t/users/items" variant="contained" className="mt-8">
          Connect
        </Button>
      </section>
    </div>
  );
}
