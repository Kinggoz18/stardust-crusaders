export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: import("react").ReactNode;
}) {
  return (
    <div className="state empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <h2>Could not load</h2>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="banner" role="status">
      You appear offline. Changes will wait until you reconnect.
    </div>
  );
}
