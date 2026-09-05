import Link from "next/link";
import {
  Coins,
  ArrowRightLeft,
  ReceiptText,
  Scale,
  ChevronRight,
  Ship,
  ShieldAlert,
  Banknote,
  Activity,
} from "lucide-react";
import { getAccountContext } from "@/lib/auth";

export const metadata = {
  title: "Post-Entry | Qubere",
  description: "Manage drawback, ACE reconciliation, post-summary corrections, and protests in one place.",
};

const TOOLS = [
  {
    id: "drawback",
    href: "/app/vault",
    icon: Coins,
    label: "Duty Drawback",
    description:
      "Identify, quantify, and file duty drawback claims. Track lot eligibility and export deadlines to maximize your refund recovery.",
    accent: "from-amber-500 to-yellow-400",
  },
  {
    id: "reconciliation",
    href: "/app/reconciliation",
    icon: ArrowRightLeft,
    label: "ACE Reconciliation",
    description:
      "Surface discrepancies between entry summaries and source documents. Convert issues to Post-Summary Corrections directly from the queue.",
    accent: "from-blue-500 to-cyan-400",
  },
  {
    id: "psc",
    href: "/app/post-entry/psc",
    icon: ReceiptText,
    label: "Post-Summary Corrections",
    description:
      "Correct entry summaries before CBP liquidation within the 270-day window. Recalculate duties and manage ACE transmissions.",
    accent: "from-violet-500 to-purple-400",
  },
  {
    id: "protest",
    href: "/app/post-entry/protests",
    icon: Scale,
    label: "Protests (Form 19)",
    description:
      "Challenge CBP liquidation decisions under 19 U.S.C. § 1514 within the 180-day window. Track deemed denials and CIT appeal deadlines.",
    accent: "from-indigo-500 to-blue-600",
  },
  {
    id: "isf",
    href: "/app/post-entry/isf",
    icon: Ship,
    label: "ISF 10+2 Filings",
    description:
      "Prepare and submit Importer Security Filings. Tracks the 24-hour pre-lading deadline, missing 10+2 elements, bond coverage, and liquidated-damages exposure.",
    accent: "from-sky-500 to-blue-500",
  },
  {
    id: "prior-disclosure",
    href: "/app/post-entry/prior-disclosure",
    icon: ShieldAlert,
    label: "Prior Disclosure (§1592)",
    description:
      "Model 19 U.S.C. § 1592 penalty exposure by culpability and record the tender. A valid prior disclosure caps the penalty at interest (or actual loss for fraud).",
    accent: "from-rose-500 to-red-500",
  },
  {
    id: "cbp-reconciliation",
    href: "/app/post-entry/cbp-reconciliation",
    icon: ArrowRightLeft,
    label: "CBP Reconciliation Program",
    description:
      "Flag entries for the 21-month Reconciliation Program (value, classification, FTA, 9802) and bundle them into a reconciliation entry for transmission.",
    accent: "from-teal-500 to-emerald-500",
  },
  {
    id: "duty-payments",
    href: "/app/post-entry/duty-payments",
    icon: Banknote,
    label: "Duty Statement Payments",
    description:
      "Track ACH payment instructions for daily and Periodic Monthly Statements — deadline math, scheduling, and settlement lifecycle. Does not move funds.",
    accent: "from-lime-500 to-green-500",
  },
  {
    id: "filer-health",
    href: "/app/post-entry/filer-health",
    icon: Activity,
    label: "Filer Admin Health",
    description:
      "19 CFR 143 Subpart A monitoring: fatal-error rate from your filer export history, ABI credential state, and connection status for your filer code.",
    accent: "from-fuchsia-500 to-purple-500",
  },
] as const;

export default async function PostEntryPage() {
  const ctx = await getAccountContext();
  if (!ctx) return null;

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Page header */}
      <div className="border-b border-border bg-white/70 backdrop-blur-sm px-6 py-5">
        <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">
          <span>Main Operations</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-ink font-medium">Post-Entry</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-[#5AC8FA] flex items-center justify-center shadow-sm shadow-brand/20">
            <ReceiptText className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Post-Entry Management</h1>
            <p className="text-sm text-ink-muted">
              Drawback, ACE reconciliation, post-summary corrections, and Form 19 protests.
            </p>
          </div>
        </div>
      </div>

      {/* Tool pills */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-brand/30"
              >
                {/* Icon */}
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.accent} flex items-center justify-center shadow-sm`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-ink group-hover:text-brand transition-colors">
                    {tool.label}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight className="absolute top-5 right-5 w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
