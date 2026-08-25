"use client";

import { X, ArrowRight, CheckCircle2, Zap, Sparkles, Layers } from "lucide-react";
import Link from "next/link";

interface FeatureDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: {
    id: string;
    title: string;
    category: string;
    icon: any;
    route: string;
    badge: string;
    summary: string;
    keyCapabilities: string[];
    howToSteps: { stepNumber: number; title: string; instruction: string }[];
    proTip?: string;
  } | null;
}

export function FeatureDetailModal({ isOpen, onClose, feature }: FeatureDetailModalProps) {
  if (!isOpen || !feature) return null;

  const IconComponent = feature.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-white border border-border rounded-3xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-surface-muted/60 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-ink">{feature.title}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-brand/10 text-brand">
                  {feature.badge}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{feature.category} • Module Blueprint</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-border hover:bg-surface-muted flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Executive Summary */}
          <div className="p-4 rounded-2xl bg-white border border-border space-y-2">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider">Executive Overview</h3>
            <p className="text-sm text-ink leading-relaxed font-medium">{feature.summary}</p>
          </div>

          {/* Key Capabilities & Policy Governance */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-brand" />
              <span>Core Capabilities & Operational Policies</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {feature.keyCapabilities.map((cap, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-surface-muted/60 border border-border flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-xs text-ink font-medium leading-relaxed">{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Workflow Blueprint */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Execution Workflow Blueprint</span>
            </h3>

            <div className="space-y-2.5">
              {feature.howToSteps.map((step) => (
                <div key={step.stepNumber} className="p-4 rounded-2xl bg-surface-muted/40 border border-border flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-brand text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {step.stepNumber}
                  </span>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-ink">{step.title}</h4>
                    <p className="text-xs text-ink-muted leading-relaxed font-medium">{step.instruction}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip Callout */}
          {feature.proTip && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-950">Expert Pro Tip: </strong>
                <span className="text-amber-900 leading-relaxed font-medium">{feature.proTip}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-surface-muted/60 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-border text-xs font-bold text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            Close Blueprint
          </button>

          <Link
            href={feature.route}
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all inline-flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <span>Launch Live Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
