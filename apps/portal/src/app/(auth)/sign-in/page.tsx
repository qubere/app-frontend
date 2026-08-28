"use client";

import React, { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  const { client, setActive, loaded } = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("porter@target.com");
  const [password, setPassword] = useState("QuberePass2026!");
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
        router.push("/");
      } else {
        setError("Sign in requires additional verification.");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || "Invalid email address or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-2">
              Work Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="porter@target.com"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#FAFAFC] border border-[#E5E5EA] text-[#1D1D1F] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0071E3] focus:outline-none transition shadow-2xs"
            />
          </div>

          <Button type="submit" disabled={loading || !loaded} className="w-full py-3 text-sm font-bold flex items-center justify-center space-x-2 cursor-pointer">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? "Signing In..." : "Sign In to Customer Portal"}</span>
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-[#86868B]">
          Default demo login: <code className="bg-[#E5E5EA] px-1.5 py-0.5 rounded text-[#1D1D1F] font-mono">porter@target.com</code> / <code className="bg-[#E5E5EA] px-1.5 py-0.5 rounded text-[#1D1D1F] font-mono">QuberePass2026!</code>
        </div>
      </Card>
    </div>
  );
}
