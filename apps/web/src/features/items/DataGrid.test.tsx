import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DataGrid } from "./DataGrid.js";

const digits = "12345678901234567890123456789012345678";

function rows(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    id: { S: `id-${String(index)}` },
    note: { S: index === 0 ? "" : `note-${String(index)}` },
  }));
}

describe("DataGrid", () => {
  it("virtualizes a thousand rows and keeps a 38-digit number exact", () => {
    render(
      <div className="flex h-[400px] flex-col">
        <DataGrid
          items={[
            { id: { S: "number-38" }, digits: { N: digits } },
            ...Array.from({ length: 999 }, (_unused, index) => ({
              id: { S: `id-${String(index)}` },
              digits: { N: "1" },
            })),
          ]}
          columns={["id", "digits"]}
          keys={[{ name: "id", keyType: "HASH" }]}
          widths={{ id: 160, digits: 280 }}
          onWidth={() => undefined}
          rowPx={48}
          selected={new Set()}
          onSelected={() => undefined}
          onOpen={() => undefined}
        />
      </div>,
    );
    expect(screen.getByText(digits)).toBeInTheDocument();
    expect(screen.queryByText("id-998")).not.toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Items" })).toHaveAttribute("aria-rowcount", "1001");
  });

  it("resizes from the keyboard, selects a range, and opens on enter", async () => {
    const user = userEvent.setup();
    function Widths() {
      const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
      const [width, setWidth] = useState(160);
      const [opened, setOpened] = useState("");
      return (
        <div className="flex h-[400px] flex-col">
          <p>{selected.size} selected</p>
          <p>width {width}</p>
          <p>opened {opened}</p>
          <DataGrid
            items={rows(5)}
            columns={["id", "note"]}
            keys={[{ name: "id", keyType: "HASH" }]}
            widths={{ id: width, note: 160 }}
            onWidth={(_name, next) => {
              setWidth(next);
            }}
            rowPx={48}
            selected={selected}
            onSelected={setSelected}
            onOpen={() => {
              setOpened("yes");
            }}
          />
        </div>
      );
    }
    render(<Widths />);
    await user.click(screen.getByRole("button", { name: "Resize id" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("width 176")).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox", { name: /Select row/ });
    const first = boxes[0];
    const third = boxes[2];
    if (first === undefined || third === undefined) {
      throw new Error("expected rows");
    }
    await user.click(first);
    await user.keyboard("{Shift>}");
    await user.click(third);
    await user.keyboard("{/Shift}");
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Select all loaded items" }));
    expect(screen.getByText("5 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "id" }));
    expect(screen.getByText("Sorted locally (loaded items only)")).toBeInTheDocument();
    screen.getByRole("grid", { name: "Items" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("opened yes")).toBeInTheDocument();
  });
});
