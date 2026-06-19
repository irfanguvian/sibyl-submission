"use client";

import { ACCEPT_ATTR, UPLOAD_HINT, validateUploadFile } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

/**
 * Accessible file picker that supports both click-to-browse and drag-and-drop.
 * Validates type/size client-side (see `lib/uploads.ts`).
 *
 * Single-file mode (default) reports the chosen file via `onFile`. Multi-file
 * mode (`multiple`) reports every valid file via `onFiles`; the parent owns the
 * upload action so the same control is reused for case and profile documents.
 */
export function FileDropzone({
  onFile,
  onFiles,
  multiple = false,
  disabled = false,
  accept = ACCEPT_ATTR,
}: {
  onFile?: (file: File | null) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(fileList: FileList | null | undefined) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }

    if (multiple) {
      const valid: File[] = [];
      let firstError: string | null = null;
      for (const file of files) {
        const result = validateUploadFile(file);
        if (result.ok) {
          valid.push(file);
        } else if (!firstError) {
          firstError = result.error;
        }
      }
      setError(firstError);
      if (valid.length > 0) {
        onFiles?.(valid);
      }
      return;
    }

    const file = files[0];
    const result = validateUploadFile(file);
    if (!result.ok) {
      setError(result.error);
      setSelected(null);
      onFile?.(null);
      return;
    }
    setError(null);
    setSelected(file);
    onFile?.(file);
  }

  function openPicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        aria-label="Upload document"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        data-testid="file-dropzone"
        data-drag-over={dragOver}
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) {
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed p-6 text-center text-sm transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent",
          dragOver && "border-primary bg-accent",
        )}
      >
        {!multiple && selected ? (
          <span className="font-medium">
            {selected.name} · {(selected.size / 1024).toFixed(0)} KB
          </span>
        ) : (
          <>
            <span className="font-medium">
              {multiple
                ? "Drop files here or click to browse"
                : "Drop a file here or click to browse"}
            </span>
            <span className="text-muted-foreground text-xs">{UPLOAD_HINT}</span>
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
