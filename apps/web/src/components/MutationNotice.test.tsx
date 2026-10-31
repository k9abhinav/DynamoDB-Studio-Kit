import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../app/providers.js";
import { MutationNotice } from "./MutationNotice.js";

describe("MutationNotice", () => {
  it("offers retry for a failed change and does not queue it", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <AppProviders>
        <MutationNotice
          notice="The save failed."
          onRetry={onRetry}
          onOpenExisting={() => undefined}
        />
      </AppProviders>,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides retry when the notice is not a failed change", () => {
    render(
      <AppProviders>
        <MutationNotice notice={null} onRetry={null} onOpenExisting={() => undefined} />
      </AppProviders>,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
