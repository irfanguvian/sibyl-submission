import { Button } from "@/components/ui/button";

/** Loading skeleton — a few shimmering rows. */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center"
    >
      <p className="text-destructive text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
