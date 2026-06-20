import CaseDetailPage from "@/app/cases/[id]/page";
import type { Case } from "@/lib/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "c1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// ── Mock next/link (renders plain <a>) ───────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Mutable auth state ────────────────────────────────────────────────────────
const authState: {
  user: { id: string; email: string; role: "PARENT" | "TUTOR" } | null;
} = { user: { id: "p1", email: "parent@example.com", role: "PARENT" } };

vi.mock("@/lib/use-auth", () => ({
  useAuth: () => ({ user: authState.user, isLoading: false }),
}));

// ── Mutable case state ────────────────────────────────────────────────────────
let caseData: Case = {
  id: "c1",
  title: "Maths Help",
  subject: "Mathematics",
  level: "GCSE",
  location: "London",
  budgetPerHour: 30,
  status: "OPEN",
  ownerId: "p1",
  createdAt: "",
  updatedAt: "",
};

const updateMutate = vi.fn();

vi.mock("@/lib/use-cases", () => ({
  useCase: () => ({ data: caseData, isLoading: false, isError: false, refetch: vi.fn() }),
  useCaseDocuments: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateCase: () => ({ mutate: updateMutate, isPending: false }),
  useCaseInvites: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useInviteTutor: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useRevokeInvite: () => ({ mutate: vi.fn(), isPending: false }),
  useAcceptTutor: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useRecommendations: () => ({ data: [], isLoading: false, isError: false }),
  useDeleteCaseDocument: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

vi.mock("@/lib/api", () => ({
  casesApi: {
    listInvites: vi.fn().mockResolvedValue([]),
    invite: vi.fn(),
    accept: vi.fn(),
    revokeInvite: vi.fn(),
    recommendations: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn(),
    downloadUrl: (id: string) => `/api/proxy/documents/${id}/download`,
  },
  tutorsApi: {
    directory: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  },
  uploadDocument: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CaseDetailPage — close-case button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "p1", email: "parent@example.com", role: "PARENT" };
    caseData = {
      id: "c1",
      title: "Maths Help",
      subject: "Mathematics",
      level: "GCSE",
      location: "London",
      budgetPerHour: 30,
      status: "OPEN",
      ownerId: "p1",
      createdAt: "",
      updatedAt: "",
    };
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("owner sees the Close case button when status is OPEN", () => {
    render(<CaseDetailPage />, { wrapper });
    expect(screen.getByRole("button", { name: /close case/i })).toBeInTheDocument();
  });

  it("owner does not see the Close case button when status is CLOSED", () => {
    caseData = { ...caseData, status: "CLOSED" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByRole("button", { name: /close case/i })).not.toBeInTheDocument();
  });

  it("non-owner (tutor) does not see the Close case button", () => {
    authState.user = { id: "t1", email: "tutor@example.com", role: "TUTOR" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByRole("button", { name: /close case/i })).not.toBeInTheDocument();
  });

  it("clicking Close case calls confirm then mutate with {status: 'CLOSED'}", async () => {
    render(<CaseDetailPage />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /close case/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith({ status: "CLOSED" }));
  });

  it("does NOT call mutate when confirm is cancelled", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    render(<CaseDetailPage />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /close case/i }));
    expect(updateMutate).not.toHaveBeenCalled();
  });
});

describe("CaseDetailPage — canUpload matrix via dropzone presence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("owner on OPEN case sees upload dropzone", () => {
    authState.user = { id: "p1", email: "parent@example.com", role: "PARENT" };
    caseData = { ...caseData, status: "OPEN", ownerId: "p1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.getByLabelText("Upload document")).toBeInTheDocument();
  });

  it("owner on MATCHED case sees upload dropzone", () => {
    authState.user = { id: "p1", email: "parent@example.com", role: "PARENT" };
    caseData = { ...caseData, status: "MATCHED", ownerId: "p1", matchedTutorId: "t1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.getByLabelText("Upload document")).toBeInTheDocument();
  });

  it("owner on CLOSED case does NOT see upload dropzone", () => {
    authState.user = { id: "p1", email: "parent@example.com", role: "PARENT" };
    caseData = { ...caseData, status: "CLOSED", ownerId: "p1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByLabelText("Upload document")).not.toBeInTheDocument();
  });

  it("matched tutor on MATCHED case sees upload dropzone", () => {
    authState.user = { id: "t1", email: "tutor@example.com", role: "TUTOR" };
    caseData = { ...caseData, status: "MATCHED", ownerId: "p1", matchedTutorId: "t1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.getByLabelText("Upload document")).toBeInTheDocument();
  });

  it("non-matched tutor on MATCHED case does NOT see upload dropzone", () => {
    authState.user = { id: "t2", email: "other@example.com", role: "TUTOR" };
    caseData = { ...caseData, status: "MATCHED", ownerId: "p1", matchedTutorId: "t1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByLabelText("Upload document")).not.toBeInTheDocument();
  });

  it("any tutor on CLOSED case does NOT see upload dropzone", () => {
    authState.user = { id: "t1", email: "tutor@example.com", role: "TUTOR" };
    caseData = { ...caseData, status: "CLOSED", ownerId: "p1", matchedTutorId: "t1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByLabelText("Upload document")).not.toBeInTheDocument();
  });

  it("tutor on OPEN case sees upload dropzone", () => {
    authState.user = { id: "t1", email: "tutor@example.com", role: "TUTOR" };
    caseData = { ...caseData, status: "OPEN", ownerId: "p1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.getByLabelText("Upload document")).toBeInTheDocument();
  });
});

describe("CaseDetailPage — RecommendationPanel visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    authState.user = { id: "p1", email: "parent@example.com", role: "PARENT" };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows RecommendationPanel for owner on OPEN case", () => {
    caseData = { ...caseData, status: "OPEN", ownerId: "p1" };
    render(<CaseDetailPage />, { wrapper });
    // The panel renders its heading when visible
    expect(screen.getByText(/suggestions/i)).toBeInTheDocument();
  });

  it("does not show RecommendationPanel for owner on MATCHED case", () => {
    caseData = { ...caseData, status: "MATCHED", ownerId: "p1", matchedTutorId: "t1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByText(/suggestions/i)).not.toBeInTheDocument();
  });

  it("does not show RecommendationPanel for owner on CLOSED case", () => {
    caseData = { ...caseData, status: "CLOSED", ownerId: "p1" };
    render(<CaseDetailPage />, { wrapper });
    expect(screen.queryByText(/suggestions/i)).not.toBeInTheDocument();
  });
});
