import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../app/providers.js";
import { RouteErrorReset } from "./RouteErrorReset.js";

describe("RouteErrorReset", () => {
  it("keeps the shell and retries the screen", async () => {
    const user = userEvent.setup();
    let fail = true;
    function Boom() {
      if (fail) {
        throw new Error("boom");
      }
      return <h1>Recovered</h1>;
    }
    render(
      <AppProviders>
        <h1>Shell</h1>
        <RouteErrorReset>
          <Boom />
        </RouteErrorReset>
      </AppProviders>,
    );
    expect(screen.getByRole("heading", { name: "Shell" })).toBeInTheDocument();
    expect(screen.getByText("This screen hit a problem.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("heading", { name: "Recovered" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shell" })).toBeInTheDocument();
  });
});
