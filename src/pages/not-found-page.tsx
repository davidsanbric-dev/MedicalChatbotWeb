import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">This page isn’t part of the pipeline</h1>
      <Link to="/" className="mt-6 inline-block text-ink underline underline-offset-4">
        Back to the architecture
      </Link>
    </div>
  );
}
