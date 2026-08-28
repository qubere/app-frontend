"use client";

import { SignIn } from "@clerk/nextjs";
import {
  Zap,
  Network,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Top Brand Header */}
      <header className="w-full border-b border-[#E5E5EA] bg-white/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0071E3] flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-[#0071E3]/25">
              Q
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-[#1D1D1F]">Qubere</span>
              <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                TMS Operating Engine
              </span>
            </div>
          </div>

          <a
            href="https://www.qubere.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#86868B] hover:text-[#0071E3] transition-colors"
          >
            <span>qubere.ai</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Subtle Product & Cutting-Edge Tech Showcase */}
        <div className="lg:col-span-7 space-y-8 pr-0 lg:pr-6">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E5EA] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0071E3]"></span>
              </span>
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-wide">
                Autonomous Freight Execution &amp; Dispatch Operating Layer
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1D1D1F] tracking-tight leading-[1.12]">
              Autonomous Freight Execution &amp; <br />
              <span className="bg-gradient-to-r from-[#0071E3] via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Freight OS
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#86868B] leading-relaxed max-w-2xl font-normal">
              Automated carrier tendering, real-time rate waterfall optimization, predictive exception tracking, and 3-way freight invoice reconciliation.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] mb-3 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Autonomous Carrier Waterfall</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Smart spot rate benchmarking and automated tender dispatches across contracted carrier cascades.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">AI Trade Knowledge Graph</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Connected supplier, carrier, and lane graph intelligence resolving operational friction before tender dispatch.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-3 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Real-Time Exception Queue</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Predictive tracking alerts for dispatch timeouts, lane delays, and automatic secondary carrier re-tendering.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-110 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Automated 3-Way Freight Audit</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Instant audit matching of freight bills against tendered rates, contracted tariffs, and accessorial quotes.
              </p>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="pt-2 border-t border-[#E5E5EA]/80 flex flex-wrap items-center justify-between text-xs text-[#86868B] gap-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-[#1D1D1F]">Zero-Headcount Scale</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
              <span className="font-semibold text-[#1D1D1F]">&lt; 2 Min Tender Cycle Time</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-[#1D1D1F]">100% 3-Way Invoice Reconciliation</span>
            </div>
          </div>
        </div>

        {/* Right Column: Styled Clerk Sign In */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-[#E5E5EA] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/5 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0071E3]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-6 relative z-10">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-[#0071E3] items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-[#0071E3]/30 mb-3">
                Q
              </div>
              <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Qubere TMS Sign In</h2>
              <p className="text-[#86868B] text-xs mt-1.5">
                Enterprise access for dispatchers, logistics managers &amp; carriers.
              </p>
            </div>

            {/* Clerk Component Wrapper */}
            <div className="relative z-10 flex justify-center">
              <SignIn
                forceRedirectUrl="/"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none p-0 w-full",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl py-2.5 transition-all text-xs font-semibold shadow-2xs",
                    formFieldLabel: "text-[#1D1D1F] text-xs font-semibold uppercase tracking-wider mb-1.5",
                    formFieldInput: "bg-white border-[#E5E5EA] text-[#1D1D1F] rounded-xl focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3] py-2.5 px-3 text-sm shadow-2xs",
                    formButtonPrimary: "bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.99] text-white font-bold rounded-xl py-3 text-sm shadow-md shadow-[#0071E3]/25 transition-all cursor-pointer",
                    footerActionLink: "text-[#0071E3] hover:text-[#0077ED] font-semibold text-xs",
                    footer: "border-t border-[#E5E5EA] pt-4 mt-4 text-xs text-[#86868B]",
                    identityPreviewText: "text-[#1D1D1F] font-semibold text-xs",
                    identityPreviewEditButton: "text-[#0071E3] text-xs font-semibold",
                  },
                }}
              />
            </div>

            <div className="mt-5 pt-4 border-t border-[#E5E5EA] text-center text-[11px] text-[#86868B]">
              <div className="inline-flex items-center space-x-1.5 text-[#0071E3] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise Governed Autonomous Logistics OS</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#E5E5EA] py-4 bg-white/50 text-center text-xs text-[#86868B]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Qubere Inc. All rights reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Autonomous Freight Execution Engine</span>
            <span>·</span>
            <a href="https://www.qubere.ai" target="_blank" rel="noopener noreferrer" className="hover:underline text-[#0071E3]">
              qubere.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

