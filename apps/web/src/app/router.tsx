import { createBrowserRouter, Outlet, type RouteObject } from "react-router-dom";
import { AboutDialog } from "../components/AboutDialog.js";
import { CommandPalette } from "../components/CommandPalette.js";
import { ShortcutHelpDialog } from "../components/ShortcutHelpDialog.js";
import { ConnectPlaceholder } from "../features/connection/ConnectPlaceholder.js";
import { NotFound } from "../features/connection/NotFound.js";
import { Workspace } from "../features/workspace/Workspace.js";

function ShellLayout() {
  return (
    <>
      <Outlet />
      <CommandPalette />
      <ShortcutHelpDialog />
      <AboutDialog />
    </>
  );
}

export function appRoutes(): RouteObject[] {
  const children: RouteObject[] = [
    { path: "/", element: <ConnectPlaceholder /> },
    { path: "/c/:connId", element: <Workspace /> },
    { path: "/c/:connId/t/:table/:tab", element: <Workspace /> },
    { path: "*", element: <NotFound /> },
  ];
  if (import.meta.env.DEV) {
    children.push({
      path: "/__design",
      lazy: () =>
        import("../features/design/DesignGallery.js").then((module) => ({
          Component: module.DesignGallery,
        })),
    });
  }
  return [{ element: <ShellLayout />, children }];
}

export const browserRouter = createBrowserRouter(appRoutes());
