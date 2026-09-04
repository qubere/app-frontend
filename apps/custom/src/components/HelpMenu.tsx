import Link from "next/link";
import { HelpCircle } from "lucide-react";

export function HelpMenu() {
  return (
    <Link
      href="/app/support"
      className="flex items-center shrink-0 rounded-full p-2 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      aria-label="Open Qubere Help Center"
      title="Help Center"
    >
      <HelpCircle className="w-5 h-5 text-ink-muted" aria-hidden="true" />
    </Link>
  );
}
