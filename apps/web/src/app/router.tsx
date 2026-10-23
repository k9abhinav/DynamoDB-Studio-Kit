import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet, type RouteObject } from "react-router-dom";
import { AboutDialog } from "../components/AboutDialog.js";
import { CommandPalette } from "../components/CommandPalette.js";
import { ShortcutHelpDialog } from "../components/ShortcutHelpDialog.js";
import { NotFound } from "../features/connection/NotFound.js";

const ConnectScreen = lazy(() =>
  import("../features/connection/ConnectScreen.js").then((module) => ({
    default: module.ConnectScreen,
  })),
);

const Workspace = lazy(() =>
  import("../features/workspace/Workspace.js").then((module) => ({
    default: module.Workspace,
  })),
);

function RouteFallback() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center text-text-secondary"
      role="status"
      aria-label="Loading"
    >
      Loading
    </div>
  );
}

function ShellLayout() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      <CommandPalette />
      <ShortcutHelpDialog />
      <AboutDialog />
    </>
  );
}

export function appRoutes(): RouteObject[] {
  const children: RouteObject[] = [
    { path: "/", element: <ConnectScreen /> },
    { path: "/c/:connId", element: <Workspace /> },
    { path: "/c/:connId/t/:table/:tab", element: <Workspace /> },
    { path: "*", element: <NotFound /> },
  ];
  if (import.meta.env.DEV) {
    const DesignGallery = lazy(() =>
      import("../features/design/DesignGallery.js").then((module) => ({
        default: module.DesignGallery,
      })),
    );
    children.push({
      path: "/__design",
      element: <DesignGallery />,
    });
  }
  return [{ element: <ShellLayout />, children }];
}

export const browserRouter = createBrowserRouter(appRoutes());
