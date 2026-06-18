import { DashboardShell } from "@/components/dashboard-shell";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// DashboardShell is a client component — safe to render in jsdom.
describe("DashboardShell", () => {
  it("renders the brand name", () => {
    render(<DashboardShell>content</DashboardShell>);
    // Brand appears in desktop sidebar and mobile topbar
    const brands = screen.getAllByText("Tuition");
    expect(brands.length).toBeGreaterThan(0);
  });

  it("renders nav links in the desktop sidebar", () => {
    render(<DashboardShell>content</DashboardShell>);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cases/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tutors/i })).toBeInTheDocument();
  });

  it("renders children in main content area", () => {
    render(
      <DashboardShell>
        <p>hello world</p>
      </DashboardShell>,
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("shows mobile menu trigger button", () => {
    render(<DashboardShell>content</DashboardShell>);
    expect(screen.getByTestId("mobile-menu-trigger")).toBeInTheDocument();
  });

  it("opens the mobile drawer when menu button is clicked", async () => {
    const user = userEvent.setup();
    render(<DashboardShell>content</DashboardShell>);
    const trigger = screen.getByTestId("mobile-menu-trigger");
    await user.click(trigger);
    // Sheet content has role="dialog" when open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
