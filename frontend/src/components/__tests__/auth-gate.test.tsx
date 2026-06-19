import { AuthGate } from "@/components/auth-gate";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();
let pathname = "/";
const authState: {
  user: { id: string; email: string; role: "PARENT" | "TUTOR" } | null;
  isLoading: boolean;
} = { user: null, isLoading: false };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoading: authState.isLoading,
    logout: { mutate: vi.fn() },
  }),
}));

describe("AuthGate", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pathname = "/";
    authState.user = null;
    authState.isLoading = false;
  });
  afterEach(() => vi.clearAllMocks());

  it("renders public routes bare without redirect", () => {
    pathname = "/login";
    render(
      <AuthGate>
        <p>login content</p>
      </AuthGate>,
    );
    expect(screen.getByText("login content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Tuition")).not.toBeInTheDocument();
  });

  it("redirects to /login on a protected route when unauthenticated", async () => {
    pathname = "/cases";
    authState.user = null;
    render(
      <AuthGate>
        <p>protected content</p>
      </AuthGate>,
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders the dashboard shell with children when authenticated", () => {
    pathname = "/cases";
    authState.user = { id: "u1", email: "parent@example.com", role: "PARENT" };
    render(
      <AuthGate>
        <p>protected content</p>
      </AuthGate>,
    );
    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(screen.getByText("parent@example.com")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
