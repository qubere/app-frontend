import Link from "next/link";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  resourceType?: string;
  resourceId?: string;
  accountName?: string;
}

export function AccessDenied({
  title = "Access Denied",
  message = "You do not have permission to view or manage this resource. Access is restricted to authorized account members or administrators.",
  resourceType = "Shipment",
  resourceId,
  accountName,
}: AccessDeniedProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-600">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" /> 403 Forbidden
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
        </div>

        {(resourceId || accountName) && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-1.5 font-mono">
            {resourceId && (
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans font-semibold">{resourceType}:</span>
                <span className="font-bold text-slate-800">{resourceId}</span>
              </div>
            )}
            {accountName && (
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans font-semibold">Account:</span>
                <span className="font-bold text-slate-800">{accountName}</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/app/shipments"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Shipments Workbench
          </Link>
        </div>
      </div>
    </div>
  );
}
