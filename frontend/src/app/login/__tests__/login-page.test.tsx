import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../page";

const pushMock = vi.fn();
const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "parent@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.submit(screen.getByRole("form", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the sign-in form", () => {
    render(<LoginPage />, { wrapper });
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("posts credentials and redirects on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />, { wrapper });
    fillAndSubmit();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/cases"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error and does not redirect on bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    render(<LoginPage />, { wrapper });
    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  describe("demo mode quick-login", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("hides quick-login buttons when demo mode is off", () => {
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
      render(<LoginPage />, { wrapper });
      expect(screen.queryByRole("button", { name: /sign in as parent/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /sign in as tutor/i })).not.toBeInTheDocument();
    });

    it("shows quick-login buttons and submits demo creds when demo mode is on", async () => {
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      render(<LoginPage />, { wrapper });
      const parentBtn = screen.getByRole("button", { name: /sign in as parent/i });
      expect(screen.getByRole("button", { name: /sign in as tutor/i })).toBeInTheDocument();

      fireEvent.click(parentBtn);

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/cases"));
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "parent@example.com", password: "password123" }),
        }),
      );
    });
  });
});
