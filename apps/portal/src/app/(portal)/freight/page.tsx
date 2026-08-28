"use client";

import React, { useState } from "react";
import { TruckIcon } from "../icons";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface FreightOrder {
  id: string;
  orderNumber: string;
  carrierName: string;
  origin: string;
  destination: string;
  status: string;
  estimatedDelivery: string;
}

export default function FreightPage() {
  const [orders] = useState<FreightOrder[]>([
    {
      id: "ord_101",
      orderNumber: "TMS-2026-8841",
      carrierName: "Swift Logistics",
      origin: "Chicago, IL",
      destination: "Dallas, TX",
      status: "In Transit",
      estimatedDelivery: "2026-08-29",
    },
    {
      id: "ord_102",
      orderNumber: "TMS-2026-8842",
      carrierName: "FedEx Freight",
      origin: "Los Angeles, CA",
      destination: "Phoenix, AZ",
      status: "POD Received",
      estimatedDelivery: "2026-08-27",
    },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Freight & Transport Orders</h1>
        <p className="text-[#86868B] text-xs mt-1">
          TMS carrier tracking, dispatch milestones, Bills of Lading (BOL), and Proofs of Delivery (POD).
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F5F5F7] text-[#86868B] font-semibold border-b border-[#E5E5EA] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Carrier</th>
                <th className="px-6 py-4">Route</th>
                <th className="px-6 py-4">Est. Delivery</th>
                <th className="px-6 py-4">Freight Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5EA]">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-[#F5F5F7]/80 transition">
                  <td className="px-6 py-4 font-mono font-bold text-[#0071E3]">{ord.orderNumber}</td>
                  <td className="px-6 py-4 text-[#1D1D1F] font-medium">{ord.carrierName}</td>
                  <td className="px-6 py-4 text-[#1D1D1F]">
                    {ord.origin} &rarr; {ord.destination}
                  </td>
                  <td className="px-6 py-4 text-[#1D1D1F]">{ord.estimatedDelivery}</td>
                  <td className="px-6 py-4">
                    <Badge variant={ord.status === "POD Received" ? "success" : "info"}>
                      {ord.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="secondary" size="sm">
                      View POD
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
