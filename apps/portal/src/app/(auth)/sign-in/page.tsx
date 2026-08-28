"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] px-4">
      <Card className="max-w-md w-full p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-[#0071E3] items-center justify-center text-white font-extrabold text-2xl shadow-md mb-4">
            Q
          </div>
          <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Customer Portal Sign In</h1>
          <p className="text-[#86868B] text-sm mt-2">
            Secure access to your shipments, entry documents, and invoices.
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); window.location.href = "/"; }}>
          <div>
            <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
              Work Email Address
            </label>
            <input
              type="email"
              required
              placeholder="importer@company.com"
              className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none transition shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none transition shadow-2xs"
            />
          </div>

          <Button type="submit" className="w-full py-3 text-sm">
            Sign In to Customer Portal
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-[#86868B]">
          Have an invitation link? Check your email or ask your customs broker.
        </div>
      </Card>
    </div>
  );
}
