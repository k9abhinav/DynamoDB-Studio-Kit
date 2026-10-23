import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { App } from "../app/App.js";
import { appRoutes } from "../app/router.js";

export function renderAt(path: string): void {
  const router = createMemoryRouter(appRoutes(), { initialEntries: [path] });
  render(<App router={router} />);
}
