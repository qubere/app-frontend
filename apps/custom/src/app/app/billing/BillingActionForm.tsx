"use client";

import { useRouter } from "next/navigation";
import React, { useState, useTransition } from "react";

type BillingFormAction = (formData: FormData) => Promise<unknown>;

export function BillingActionForm({
  action,
  children,
  className,
  confirmMessage,
  successMessage,
  successHref,
}: {
  action: BillingFormAction;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  successMessage?: string;
  successHref?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className={className}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(event.currentTarget);
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          try {
            await action(formData);
            if (successMessage) setSuccess(successMessage);
            if (successHref) router.push(successHref);
            else router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The billing action could not be completed.");
          }
        });
      }}
    >
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          {success}
        </div>
      )}
      <fieldset disabled={isPending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
