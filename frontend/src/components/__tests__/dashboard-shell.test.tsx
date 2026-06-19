import { DashboardShell } from "@/components/dashboard-shell";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

  it("shows the tutor directory link for parents, not the profile link", () => {
    render(<DashboardShell userRole="PARENT">content</DashboardShell>);
    expect(screen.getByRole("link", { name: /tutors/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /profile/i })).not.toBeInTheDocument();
  });

  it("shows the profile link for tutors, not the directory link", () => {
    render(<DashboardShell userRole="TUTOR">content</DashboardShell>);
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /tutors/i })).not.toBeInTheDocument();
  });

  it("renders user email and calls onLogout when the log out button is clicked", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(
      <DashboardShell userRole="PARENT" email="parent@example.com" onLogout={onLogout}>
        content
      </DashboardShell>,
    );
    expect(screen.getByText("parent@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
