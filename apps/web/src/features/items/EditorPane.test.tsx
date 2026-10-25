import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorPane } from "./EditorPane.js";

describe("EditorPane", () => {
  it("edits through the textarea when the code editor is unavailable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditorPane fallback issues={[]} value={'{\n  "id": "a"\n}'} onChange={onChange} />);
    const field = screen.getByRole("textbox", { name: "Item JSON" });
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "{{");
    expect(onChange).toHaveBeenCalled();
  });
});
