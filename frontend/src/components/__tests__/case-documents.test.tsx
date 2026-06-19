import { CaseDocuments } from "@/components/case-documents";
import type { DocumentMeta } from "@/lib/api-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteDocument = vi.fn();
const uploadDocument = vi.fn();

vi.mock("@/lib/api", () => ({
  casesApi: {
    deleteDocument: (...a: unknown[]) => deleteDocument(...a),
    downloadUrl: (id: string) => `/api/proxy/documents/${id}/download`,
  },
  uploadDocument: (...a: unknown[]) => uploadDocument(...a),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeFile(name: string): File {
  const f = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(f, "size", { value: 1024 });
  return f;
}

const docs: DocumentMeta[] = [
  {
    id: "d1",
    originalName: "parent-brief.pdf",
    size: 1,
    mime: "application/pdf",
    caseId: "c1",
    createdAt: "",
    uploadedById: "p1",
  },
  {
    id: "d2",
    originalName: "tutor-cv.pdf",
    size: 1,
    mime: "application/pdf",
    caseId: "c1",
    createdAt: "",
    uploadedById: "t1",
  },
];

function query(over: Partial<Parameters<typeof CaseDocuments>[0]["documents"]> = {}) {
  return { data: docs, isLoading: false, isError: false, refetch: vi.fn(), ...over };
}

describe("CaseDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteDocument.mockResolvedValue(undefined);
    uploadDocument.mockResolvedValue({ id: "new" });
  });
  afterEach(() => vi.clearAllMocks());

  it("groups documents by uploader when uploader ids are present", () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query()} canUpload={false} />, {
      wrapper,
    });
    expect(screen.getByText(/uploaded by parent/i)).toBeInTheDocument();
    expect(screen.getByText(/uploaded by tutor/i)).toBeInTheDocument();
    expect(screen.getByText("parent-brief.pdf")).toBeInTheDocument();
    expect(screen.getByText("tutor-cv.pdf")).toBeInTheDocument();
  });

  it("falls back to a single group when no uploader info is available", () => {
    const noUploader = docs.map((d) => ({ ...d, uploadedById: undefined }));
    render(
      <CaseDocuments
        caseId="c1"
        ownerId="p1"
        documents={query({ data: noUploader })}
        canUpload={false}
      />,
      { wrapper },
    );
    expect(screen.queryByText(/uploaded by parent/i)).not.toBeInTheDocument();
    expect(screen.getByText("parent-brief.pdf")).toBeInTheDocument();
  });

  it("renders a Delete action when allowed and calls the API", async () => {
    render(
      <CaseDocuments
        caseId="c1"
        ownerId="p1"
        documents={query()}
        canUpload={false}
        canDeleteDocument={() => true}
      />,
      { wrapper },
    );
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith("c1", "d1"));
  });

  it("hides Delete when not allowed", () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query()} canUpload={false} />, {
      wrapper,
    });
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("uploads multiple files and reports per-file progress", async () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query({ data: [] })} canUpload />, {
      wrapper,
    });

    const input = screen.getByLabelText("Upload document") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("a.pdf"), makeFile("b.pdf")] } });

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(2));
    expect(uploadDocument).toHaveBeenCalledWith("/cases/c1/documents", expect.any(File));

    const progress = await screen.findByLabelText("Upload progress");
    expect(progress).toHaveTextContent("a.pdf");
    expect(progress).toHaveTextContent("b.pdf");
    await waitFor(() => expect(screen.getAllByText(/uploaded/i).length).toBeGreaterThanOrEqual(2));
  });
});
