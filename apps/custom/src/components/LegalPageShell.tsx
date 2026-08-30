import Link from "next/link";
import { LandingPageHeader } from "@/components/LandingPageHeader";

interface LegalPageShellProps {
  title: string;
  lastUpdated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Public, unauthenticated shell for legal documents (Privacy Policy, EULA).
 * Kept deliberately plain so the content is easy to review and to submit to
 * third-party app reviewers (e.g. the Intuit Developer portal).
 */
export function LegalPageShell({ title, lastUpdated, intro, children }: LegalPageShellProps) {
  return (
    <div className="relative min-h-screen bg-surface-muted text-ink flex flex-col">
      <LandingPageHeader />

      <main className="flex-1 px-6 py-12 md:py-16">
        <article className="mx-auto max-w-3xl">
          <header className="mb-10 border-b border-border pb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
            <p className="mt-2 text-sm text-ink-muted">Last updated: {lastUpdated}</p>
            {intro ? <div className="mt-4 text-sm leading-relaxed text-ink-muted">{intro}</div> : null}
          </header>

          <div
            className="
              space-y-4 text-sm leading-relaxed text-ink-muted
              [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink
              [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5
              [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2
              [&_strong]:font-semibold [&_strong]:text-ink
              [&_table]:w-full [&_table]:text-left [&_table]:border-collapse
              [&_th]:border [&_th]:border-border [&_th]:bg-white [&_th]:p-2 [&_th]:font-semibold [&_th]:text-ink
              [&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:align-top
            "
          >
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-border py-6 px-6 text-center text-ink-muted text-xs">
        <p className="space-x-3">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-ink">
            Terms of Service
          </Link>
        </p>
        <p className="mt-2">© {new Date().getFullYear()} Qubere, Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
