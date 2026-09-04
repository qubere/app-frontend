"use client";

import React, { useState } from "react";
import { Card, Button } from "@/components/ui";
import { ShieldAlert, Mail, Copy, Check, ArrowLeft, Settings2 } from "lucide-react";
import Link from "next/link";

interface AccessDeniedProps {
  message?: string;
  moduleName?: string;
  requiredPermission?: string;
  adminEmail?: string;
  isUserAdmin?: boolean;
  onOpenManageAccount?: () => void;
}

export function AccessDenied({
  message,
  moduleName = "Requested Module",
  requiredPermission,
  adminEmail = "admin@qubere.ai",
  isUserAdmin = false,
  onOpenManageAccount,
}: AccessDeniedProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    if (adminEmail) {
      navigator.clipboard.writeText(adminEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const mailtoSubject = encodeURIComponent(`Access Request for ${moduleName}`);
  const mailtoBody = encodeURIComponent(
    `Hello,\n\nI am attempting to access the "${moduleName}" module in Qubere TMS. Could you please grant my user account the required role/permission (${requiredPermission || "access privileges"})?\n\nThank you!`
  );

  return (
    <div className="min-h-[75vh] bg-surface-muted flex items-center justify-center p-4 sm:p-8">
      <Card className="p-6 sm:p-8 text-center max-w-lg w-full space-y-6 shadow-md border-border bg-white rounded-3xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-black text-ink">Access Restricted</h2>
          <p className="text-sm font-semibold text-amber-700 mt-1">
            Please talk to your admin for privileges.
          </p>
        </div>

        <p className="text-xs text-ink-muted font-medium leading-relaxed">
          {message ?? `Your user account does not currently hold permission to access the ${moduleName} module.`}
        </p>

        {requiredPermission && (
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-surface-muted border border-border text-ink-muted">
              Required permission: {requiredPermission}
            </span>
          </div>
        )}

        {/* Organization Admin Contact Section */}
        <div className="p-4 rounded-2xl bg-brand/5 border border-brand/15 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Organization Admin Email
            </span>
            <span className="text-[11px] font-medium text-brand">Organization Owner</span>
          </div>

          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-border">
            <span className="text-xs font-mono font-bold text-ink truncate mr-2">
              {adminEmail}
            </span>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0"
              title="Copy Email"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <a
            href={`mailto:${adminEmail}?subject=${mailtoSubject}&body=${mailtoBody}`}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-hover transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Contact Admin via Email</span>
          </a>
        </div>

        {/* Admin Self-Service Callout */}
        {isUserAdmin && onOpenManageAccount && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-2">
            <p className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
              <Settings2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>You are an Organization Admin</span>
            </p>
            <p className="text-xs text-emerald-800">
              You can grant this permission to yourself or team members in Manage Account.
            </p>
            <button
              type="button"
              onClick={onOpenManageAccount}
              className="w-full mt-1 px-3 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition-colors cursor-pointer text-center"
            >
              Open Manage Account & Assign Roles →
            </button>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/">
            <Button variant="outline" size="sm" className="w-full sm:w-auto flex items-center justify-center space-x-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Operations</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
