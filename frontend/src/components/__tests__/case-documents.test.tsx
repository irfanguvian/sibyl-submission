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
    uploaderName: "Ada Lovelace",
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

  it("renders all documents in a flat list", () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query()} canUpload={false} />, {
      wrapper,
    });
    expect(screen.getByText("parent-brief.pdf")).toBeInTheDocument();
    expect(screen.getByText("tutor-cv.pdf")).toBeInTheDocument();
  });

  it("tags a parent-uploaded doc with 'by Parent'", () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query()} canUpload={false} />, {
      wrapper,
    });
    expect(screen.getByText("by Parent")).toBeInTheDocument();
  });

  it("tags a tutor-uploaded doc with 'by ' + uploaderName", () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query()} canUpload={false} />, {
      wrapper,
    });
    expect(screen.getByText("by Ada Lovelace")).toBeInTheDocument();
  });

  it("falls back to 'by tutor' when uploaderName is absent", () => {
    const noName: DocumentMeta[] = [
      {
        id: "d3",
        originalName: "mystery.pdf",
        size: 1,
        mime: "application/pdf",
        caseId: "c1",
        createdAt: "",
        uploadedById: "t2",
        // no uploaderName
      },
    ];
    render(
      <CaseDocuments
        caseId="c1"
        ownerId="p1"
        documents={query({ data: noName })}
        canUpload={false}
      />,
      { wrapper },
    );
    expect(screen.getByText("by tutor")).toBeInTheDocument();
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

  it("hides the upload dropzone when canUpload is false", () => {
    render(
      <CaseDocuments caseId="c1" ownerId="p1" documents={query({ data: [] })} canUpload={false} />,
      {
        wrapper,
      },
    );
    expect(screen.queryByLabelText("Upload document")).not.toBeInTheDocument();
  });

  it("shows the upload dropzone when canUpload is true", () => {
    render(<CaseDocuments caseId="c1" ownerId="p1" documents={query({ data: [] })} canUpload />, {
      wrapper,
    });
    expect(screen.getByLabelText("Upload document")).toBeInTheDocument();
  });
});
