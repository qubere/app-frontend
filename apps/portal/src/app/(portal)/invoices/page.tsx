"use client";

import React, { useEffect, useState } from "react";
import { InvoiceIcon } from "../icons";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setInvoices(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Issued Invoices</h1>
        <p className="text-[#86868B] text-xs mt-1">
          Customer-issued billing statements, due dates, balances, and official PDF downloads.
        </p>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-[#86868B] text-sm animate-pulse">Loading invoices...</Card>
      ) : invoices.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <InvoiceIcon className="w-10 h-10 text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F]">No invoices issued</h3>
          <p className="text-[#86868B] text-xs mt-1">Issued billing invoices will appear here once finalized by your broker/carrier.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F5F7] text-[#86868B] font-semibold border-b border-[#E5E5EA] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4">Balance Due</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5EA]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F5F5F7]/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-[#1D1D1F]">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-[#1D1D1F]">{new Date(inv.issueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-[#1D1D1F]">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-[#1D1D1F] font-semibold">${inv.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-amber-700 font-semibold">${inv.balanceDue.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <Badge variant="info">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a href={`/api/invoices/${inv.id}/download`}>
                        <Button variant="secondary" size="sm">
                          Download PDF
                        </Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
