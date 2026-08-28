"use client";

import React, { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  Bot,
  FileCheck2,
  Scale,
  Sparkles,
  ExternalLink,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

/** Only allow same-origin relative paths as a post-sign-in redirect. */
function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function SignInPage() {
  const { client, setActive, loaded } = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loaded || !client) return;

    setLoading(true);
    setError(null);

    try {
      const result = await client.signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        const redirectTo = safeRedirect(
          new URLSearchParams(window.location.search).get("redirect_url")
        );
        router.push(redirectTo);
      } else {
        setError("Sign in requires additional verification.");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        "Invalid email address or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Top Brand Banner */}
      <header className="w-full border-b border-[#E5E5EA] bg-white/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0071E3] flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-[#0071E3]/25">
              Q
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-[#1D1D1F]">Qubere</span>
              <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                Customer Portal
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Subtle Product & Cutting-Edge Tech Showcase */}
        <div className="lg:col-span-7 space-y-8 pr-0 lg:pr-6">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E5EA] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-wide">
                Agentic Customs &amp; Freight Intelligence Platform
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1D1D1F] tracking-tight leading-[1.12]">
              Real-Time Freight &amp; <br />
              <span className="bg-gradient-to-r from-[#0071E3] via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Customs Intelligence
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#86868B] leading-relaxed max-w-2xl font-normal">
              Autonomous import execution, 24/7 entry summary tracking, evidence-backed HTS reasoning traces, and zero-headcount landed cost visibility for importers &amp; 3PLs.
            </p>
          </div>

          {/* Product & Tech Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] mb-3 group-hover:scale-110 transition-transform">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">24/7 Agentic Document Parsing</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Multi-agent AI parses invoices, packing lists, and bills of lading with 99.8% extraction accuracy.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Evidence-Backed Reasonable Care</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Bounding-box coordinate citations grounded in 19 U.S.C. § 1484 compliance audit defense.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-110 transition-transform">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">7501 &amp; PGA Real-Time Status</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Instant CBP entry summary tracking with FDA, EPA, and FCC partner government agency screening.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E5E5EA] shadow-2xs hover:shadow-md hover:border-[#0071E3]/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#0071E3] mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">Duty Recovery &amp; Exclusion Scanning</h3>
              <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
                Continuous audit engine detecting retroactive Section 301/232 exclusions &amp; Post-Summary Correction claims.
              </p>
            </div>
          </div>

          {/* Social Proof & Performance Badges */}
          <div className="pt-2 border-t border-[#E5E5EA]/80 flex flex-wrap items-center justify-between text-xs text-[#86868B] gap-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-[#1D1D1F]">99.8% Extraction Accuracy</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
              <span className="font-semibold text-[#1D1D1F]">90% Manual Backlog Reduction</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-[#1D1D1F]">100% CBP Reasonable Care Defense</span>
            </div>
          </div>
        </div>

        {/* Right Column: Sleek Auth Form Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-[#E5E5EA] rounded-3xl p-8 shadow-2xl shadow-black/5 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0071E3]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-8 relative z-10">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-[#0071E3] items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-[#0071E3]/30 mb-4">
                Q
              </div>
              <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Customer Portal Sign In</h2>
              <p className="text-[#86868B] text-xs mt-2 leading-relaxed">
                Enter your work credentials to access live shipments, entry summaries, and landed cost invoices.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:border-[#0071E3] focus:outline-none transition shadow-2xs placeholder-[#86868B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#FAFAFC] border border-[#E5E5EA] text-[#1D1D1F] rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:border-[#0071E3] focus:outline-none transition shadow-2xs placeholder-[#86868B]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !loaded}
                className="w-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-[#0071E3]/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Customer Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#E5E5EA] text-center text-xs text-[#86868B]">
              <p>Access is governed by invitation from your customs broker or account administrator.</p>
              <div className="mt-3 inline-flex items-center space-x-1.5 text-[11px] text-[#0071E3] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>256-bit Encrypted Enterprise Gateway</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full border-t border-[#E5E5EA] py-4 bg-white/50 text-center text-xs text-[#86868B]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Qubere Inc. All rights reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Autonomous Trade Operating Layer</span>
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

