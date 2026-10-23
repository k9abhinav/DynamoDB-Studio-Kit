import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers.js";
import { browserRouter } from "./router.js";

export function App({ router = browserRouter }: { router?: typeof browserRouter }) {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
