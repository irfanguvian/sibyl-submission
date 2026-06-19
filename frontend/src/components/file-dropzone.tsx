"use client";

import { ACCEPT_ATTR, UPLOAD_HINT, validateUploadFile } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

/**
 * Accessible file picker that supports both click-to-browse and drag-and-drop.
 * Validates type/size client-side (see `lib/uploads.ts`) and reports the chosen
 * file via `onFile`. The parent owns the upload action so the same control is
 * reused for case documents and tutor-profile documents.
 */
export function FileDropzone({
  onFile,
  disabled = false,
  accept = ACCEPT_ATTR,
}: {
  onFile: (file: File | null) => void;
  disabled?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | null | undefined) {
    if (!file) {
      return;
    }
    const result = validateUploadFile(file);
    if (!result.ok) {
      setError(result.error);
      setSelected(null);
      onFile(null);
      return;
    }
    setError(null);
    setSelected(file);
    onFile(file);
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
        aria-label="Upload document"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
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
            handleFile(e.dataTransfer.files?.[0]);
          }
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed p-6 text-center text-sm transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent",
          dragOver && "border-primary bg-accent",
        )}
      >
        {selected ? (
          <span className="font-medium">
            {selected.name} · {(selected.size / 1024).toFixed(0)} KB
          </span>
        ) : (
          <>
            <span className="font-medium">Drop a file here or click to browse</span>
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
