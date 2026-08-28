"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/");
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] px-4">
      <Card className="max-w-md w-full p-8 text-center rounded-2xl shadow-xl">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-[#0071E3] items-center justify-center text-white font-extrabold text-3xl shadow-md mb-6 mx-auto">
          Q
        </div>
        <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Accept Portal Invitation</h1>
        <p className="text-[#86868B] text-sm mt-3 leading-relaxed">
          You have been invited by your customs broker to access real-time shipment status, documents, and entry summaries.
        </p>

        <div className="my-6 p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-left text-xs text-[#1D1D1F] space-y-2">
          <div className="flex justify-between">
            <span className="text-[#86868B]">Invitation Token:</span>
            <span className="font-mono text-[#0071E3]">{token?.slice(0, 12)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#86868B]">Assigned Client Scope:</span>
            <span className="font-semibold text-[#1D1D1F]">Authorized Client</span>
          </div>
        </div>

        <Button
          onClick={handleAccept}
          loading={loading}
          className="w-full py-3 text-sm"
        >
          Accept Invitation & Access Portal
        </Button>
      </Card>
    </div>
  );
}
