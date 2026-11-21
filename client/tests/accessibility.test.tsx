import React, { useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { useDialog } from "../src/hooks/useDialog";
import { PaginationToolbar } from "../src/components/common/PaginationToolbar";
import { ErrorBoundary } from "../src/components/common/ErrorBoundary";
afterEach(cleanup);
function Fixture() {
  const [open, setOpen] = useState(false);
  const props = useDialog(open, () => setOpen(false), "Test dialog");
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <div {...props}>
          <button>First</button>
          <button>Last</button>
        </div>
      )}
    </>
  );
}
it("traps Tab and restores focus when Escape closes a dialog", async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const trigger = screen.getByText("Open dialog");
  await user.click(trigger);
  expect(document.activeElement).toBe(screen.getByText("First"));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(screen.getByText("Last"));
  await user.tab();
  expect(document.activeElement).toBe(screen.getByText("First"));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it("pagination exposes labels and does not advance past boundaries", async () => {
  const user = userEvent.setup(),
    change = vi.fn();
  render(
    <PaginationToolbar
      currentPage={1}
      totalPages={1}
      totalCount={1}
      pageSize={10}
      onPageChange={change}
    />,
  );
  await user.click(screen.getByLabelText("Next Page"));
  expect(change).not.toHaveBeenCalled();
});
it("render failures expose recovery instead of a blank screen", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const swallow = (e: ErrorEvent) => {
    if (e.message === "test") e.preventDefault();
  };
  window.addEventListener("error", swallow);
  function Broken(): React.ReactNode {
    throw Error("test");
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Something went wrong",
  );
  window.removeEventListener("error", swallow);
});
