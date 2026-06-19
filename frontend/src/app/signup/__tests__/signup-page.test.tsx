import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignupPage from "../page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setRole(role: "PARENT" | "TUTOR") {
  fireEvent.change(screen.getByLabelText("I am a"), { target: { value: role } });
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the signup form fields", () => {
    render(<SignupPage />, { wrapper });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("I am a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("reveals the display name field only when the role is TUTOR", () => {
    render(<SignupPage />, { wrapper });
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();

    setRole("TUTOR");
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();

    setRole("PARENT");
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
  });

  it("shows a validation error for a short password", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<SignupPage />, { wrapper });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "p@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up" }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/register", expect.anything());
  });

  it("registers and redirects to login on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignupPage />, { wrapper });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "p@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login?registered=1"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an inline error when the email is already taken (409)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "Email already in use" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SignupPage />, { wrapper });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "taken@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up" }));

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
