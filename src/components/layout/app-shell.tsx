import { Link, Outlet } from '@tanstack/react-router';
import { MessageSquareText } from 'lucide-react';
import { LAYERS } from '@/data/layers';
import { snapshot } from '@/data/snapshot';

const PORTFOLIO_URL = 'https://davieldev.com';

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-ink px-3 py-2 text-page focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-ink">
            <img src="/favicon.svg" alt="" className="size-6" />
            <span className="hidden sm:inline">Medical RAG</span>
            <span className="hidden font-mono text-xs font-normal text-muted md:inline">/ data pipeline</span>
          </Link>
          <nav aria-label="Layers" className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
            {LAYERS.map((l) => (
              <Link
                key={l.id}
                to={l.path}
                className="group flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
                activeProps={{ className: 'bg-surface-2 text-ink' }}
              >
                <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                {l.name}
              </Link>
            ))}
          </nav>
          <Link
            to="/chat"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-page hover:bg-white"
          >
            <MessageSquareText className="size-4" />
            <span className="hidden sm:inline">Chatbot</span>
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-ink-2 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <p>
              Built by{' '}
              <a href={PORTFOLIO_URL} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                David Sanabria
              </a>{' '}
              as an end-to-end data engineering portfolio project.
            </p>
            <p className="max-w-2xl text-xs text-muted">
              Educational demo. Content is scraped from a public telehealth site and is not medical advice;
              always consult a qualified professional. Page data comes from a database snapshot taken{' '}
              {new Date(snapshot.meta.generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}.
            </p>
          </div>
          <a
            href="https://github.com/davidsanbric-dev"
            className="self-start text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
