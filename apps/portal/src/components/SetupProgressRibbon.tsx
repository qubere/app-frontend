import React from 'react';
import { CheckCircle2, Clock3, MinusCircle, ShieldCheck } from 'lucide-react';
import type { SetupSummary } from '@qubere/entry-proof';

export function SetupProgressRibbon({ onboarding }: { onboarding: SetupSummary['onboarding'] }) {
  const complete = onboarding.steps.filter(s => s.state === 'done' || s.state === 'waived').length;
  const next = onboarding.steps.find(s => s.state !== 'done' && s.state !== 'waived');
  return <section aria-label="Setup progress" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-brand"><ShieldCheck aria-hidden="true" className="size-4" />Setup progress</h2>
        <p className="text-sm font-semibold text-ink">{next ? `Next: ${next.label}` : 'Setup complete'}</p>
      </div>
      <span className="text-xs text-ink-muted">{complete} of {onboarding.steps.length} steps complete</span>
    </div>
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {onboarding.steps.map((step, index) => {
        const done = step.state === 'done', waived = step.state === 'waived', current = step.key === next?.key;
        const Icon = done ? CheckCircle2 : waived ? MinusCircle : Clock3;
        return <li key={step.key} aria-current={current ? 'step' : undefined} className={`rounded-lg border p-2.5 ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : current ? 'border-blue-300 bg-blue-50 text-blue-800 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
          <div className="mb-1.5 flex items-center justify-between"><span className="font-mono text-[10px] opacity-70">{String(index + 1).padStart(2, '0')}</span><Icon aria-hidden="true" className="size-3.5" /></div>
          <p className="text-[11px] font-semibold">{step.label}</p><span className="sr-only">: {waived ? 'Waived' : done ? 'Complete' : 'Pending'}</span>
          {waived && <p className="mt-1 text-[10px]">Waived</p>}
          <div aria-hidden="true" className={`mt-2 h-1 rounded-full ${done ? 'bg-emerald-500' : current ? 'bg-brand' : 'bg-slate-200'}`} />
        </li>;
      })}
    </ol>
  </section>;
}

export function SetupStatusPill({ status }: { status: string | null | undefined }) {
  const value = status?.toLowerCase() ?? 'not_recorded';
  const complete = ['active', 'activated', 'executed', 'verified', 'passed', 'registered', 'cleared'].includes(value);
  const attention = ['revoked', 'expired', 'declined', 'failed', 'blocked'].includes(value);
  const labels: Record<string, string> = { not_started: 'No importers on file', not_recorded: 'Not recorded', pending_5106: '5106 pending', out_for_signature: 'Awaiting signature' };
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : attention ? 'border-rose-200 bg-rose-50 text-rose-700' : value === 'in_progress' ? 'border-blue-200 bg-blue-50 text-brand' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{labels[value] ?? value.replaceAll('_', ' ')}</span>;
}
