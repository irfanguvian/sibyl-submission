import { InviteTutor } from "@/components/invite-tutor";
import type { Case } from "@/lib/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listInvites = vi.fn();
const directory = vi.fn();
const invite = vi.fn();
const accept = vi.fn();
const revokeInvite = vi.fn();

vi.mock("@/lib/api", () => ({
  casesApi: {
    listInvites: (...a: unknown[]) => listInvites(...a),
    invite: (...a: unknown[]) => invite(...a),
    accept: (...a: unknown[]) => accept(...a),
    revokeInvite: (...a: unknown[]) => revokeInvite(...a),
    recommendations: vi.fn(),
  },
  tutorsApi: {
    directory: (...a: unknown[]) => directory(...a),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const baseCase: Case = {
  id: "c1",
  title: "Maths",
  subject: "Mathematics",
  level: "GCSE",
  location: "London",
  budgetPerHour: 30,
  status: "OPEN",
  ownerId: "p1",
  createdAt: "",
  updatedAt: "",
};

describe("InviteTutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInvites.mockResolvedValue([]);
    directory.mockResolvedValue({
      data: [{ id: "tp1", userId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] }],
      meta: {},
    });
    invite.mockResolvedValue({ caseId: "c1", tutorId: "t1" });
  });
  afterEach(() => vi.clearAllMocks());

  it("searches the directory by name and invites by tutor (user) id", async () => {
    render(<InviteTutor caseItem={baseCase} />, { wrapper });

    fireEvent.change(screen.getByLabelText("Search tutors by name"), {
      target: { value: "ada" },
    });

    const result = await screen.findByText("Ada Lovelace");
    expect(result).toBeInTheDocument();

    const inviteBtn = screen.getByRole("button", { name: /^invite$/i });
    fireEvent.click(inviteBtn);

    await waitFor(() => expect(invite).toHaveBeenCalledWith("c1", "t1"));
  });

  it("renders the invited tutors list with Accept and Revoke when OPEN", async () => {
    listInvites.mockResolvedValue([
      { tutorId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] },
    ]);

    render(<InviteTutor caseItem={baseCase} />, { wrapper });

    const list = await screen.findByLabelText("Invited tutors");
    expect(list).toHaveTextContent("Ada Lovelace");
    expect(screen.getByRole("button", { name: /accept/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeEnabled();
  });

  it("shows read-only matched tutor section when status is MATCHED — no search input, no Accept/Revoke", async () => {
    listInvites.mockResolvedValue([
      { tutorId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] },
    ]);

    render(<InviteTutor caseItem={{ ...baseCase, status: "MATCHED", matchedTutorId: "t1" }} />, {
      wrapper,
    });

    // Heading shows "Matched tutor", not "Invite a tutor"
    expect(await screen.findByText("Matched tutor")).toBeInTheDocument();

    // Matched tutor name is visible (wait for invites query to resolve)
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();

    // No search input
    expect(screen.queryByLabelText("Search tutors by name")).not.toBeInTheDocument();

    // No Accept or Revoke buttons
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("shows read-only matched tutor section when status is CLOSED", async () => {
    listInvites.mockResolvedValue([
      { tutorId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] },
    ]);

    render(<InviteTutor caseItem={{ ...baseCase, status: "CLOSED", matchedTutorId: "t1" }} />, {
      wrapper,
    });

    expect(await screen.findByText("Matched tutor")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search tutors by name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("revoke causes invites to refetch and the row disappears", async () => {
    // First call returns the invited tutor; second call (after revoke) returns empty
    listInvites
      .mockResolvedValueOnce([
        { tutorId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] },
      ])
      .mockResolvedValueOnce([]);
    revokeInvite.mockResolvedValue(undefined);

    render(<InviteTutor caseItem={baseCase} />, { wrapper });

    // Tutor row is visible
    const list = await screen.findByLabelText("Invited tutors");
    expect(list).toHaveTextContent("Ada Lovelace");

    // Click Revoke
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));

    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith("c1", "t1"));

    // After refetch the row should be gone
    await waitFor(() => expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument());
  });
});
