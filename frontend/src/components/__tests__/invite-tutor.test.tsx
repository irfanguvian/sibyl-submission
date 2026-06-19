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

  it("renders the invited tutors list with Accept and Revoke", async () => {
    listInvites.mockResolvedValue([
      { tutorId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] },
    ]);

    render(<InviteTutor caseItem={baseCase} />, { wrapper });

    const list = await screen.findByLabelText("Invited tutors");
    expect(list).toHaveTextContent("Ada Lovelace");
    expect(screen.getByRole("button", { name: /accept/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeEnabled();
  });

  it("disables Accept/Revoke and shows a matched badge when the case is MATCHED", async () => {
    listInvites.mockResolvedValue([
      { tutorId: "t1", displayName: "Ada Lovelace", qualifications: ["BSc"] },
    ]);

    render(<InviteTutor caseItem={{ ...baseCase, status: "MATCHED", matchedTutorId: "t1" }} />, {
      wrapper,
    });

    const list = await screen.findByLabelText("Invited tutors");
    expect(list).toHaveTextContent("Matched");
    expect(screen.getByRole("button", { name: /accept/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeDisabled();
  });
});
