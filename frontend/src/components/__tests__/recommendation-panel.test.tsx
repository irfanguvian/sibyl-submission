import { RecommendationPanel } from "@/components/recommendation-panel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recommendations = vi.fn();
const invite = vi.fn();

vi.mock("@/lib/api", () => ({
  casesApi: {
    recommendations: (...a: unknown[]) => recommendations(...a),
    invite: (...a: unknown[]) => invite(...a),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("RecommendationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invite.mockResolvedValue({ caseId: "c1", tutorId: "t1" });
  });
  afterEach(() => vi.clearAllMocks());

  it("shows a loading state while fetching", () => {
    recommendations.mockReturnValue(new Promise(() => {}));
    render(<RecommendationPanel caseId="c1" />, { wrapper });
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("shows an empty state when there are no suggestions", async () => {
    recommendations.mockResolvedValue([]);
    render(<RecommendationPanel caseId="c1" />, { wrapper });
    expect(await screen.findByText(/no suggestions yet/i)).toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    recommendations.mockRejectedValue(new Error("boom"));
    render(<RecommendationPanel caseId="c1" />, { wrapper });
    expect(await screen.findByText(/could not load suggestions/i)).toBeInTheDocument();
  });

  it("renders ranked suggestions and invites a tutor", async () => {
    recommendations.mockResolvedValue([
      {
        tutorId: "t1",
        displayName: "Ada",
        qualifications: ["BSc"],
        score: 9,
        alreadyInvited: false,
      },
      { tutorId: "t2", displayName: "Bob", qualifications: [], score: 3, alreadyInvited: true },
    ]);

    render(<RecommendationPanel caseId="c1" />, { wrapper });

    const list = await screen.findByLabelText("Suggested tutors");
    expect(list).toHaveTextContent("Ada");
    expect(list).toHaveTextContent("score 9");
    expect(screen.getByText(/already invited/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /invite/i }));
    await waitFor(() => expect(invite).toHaveBeenCalledWith("c1", "t1"));
  });
});
