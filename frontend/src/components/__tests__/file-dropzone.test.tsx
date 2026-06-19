import { FileDropzone } from "@/components/file-dropzone";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("FileDropzone", () => {
  it("accepts a valid file via the picker and reports it", () => {
    const onFile = vi.fn();
    render(<FileDropzone onFile={onFile} />);
    const input = screen.getByLabelText("Upload document") as HTMLInputElement;
    const file = makeFile("brief.pdf", "application/pdf");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.getByText(/brief\.pdf/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("accepts a valid file via drag-and-drop", () => {
    const onFile = vi.fn();
    render(<FileDropzone onFile={onFile} />);
    const zone = screen.getByTestId("file-dropzone");
    const file = makeFile("photo.png", "image/png");

    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("rejects an unsupported file type before reporting", () => {
    const onFile = vi.fn();
    render(<FileDropzone onFile={onFile} />);
    const input = screen.getByLabelText("Upload document") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [makeFile("evil.exe", "application/octet-stream")] },
    });

    expect(onFile).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert")).toHaveTextContent(/unsupported file type/i);
  });

  it("rejects an oversized file", () => {
    const onFile = vi.fn();
    render(<FileDropzone onFile={onFile} />);
    const input = screen.getByLabelText("Upload document") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [makeFile("big.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1)] },
    });

    expect(onFile).toHaveBeenCalledWith(null);
    expect(screen.getByRole("alert")).toHaveTextContent(/too large/i);
  });

  it("toggles the drag-over state on dragover/dragleave", () => {
    render(<FileDropzone onFile={vi.fn()} />);
    const zone = screen.getByTestId("file-dropzone");

    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");

    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });
});
