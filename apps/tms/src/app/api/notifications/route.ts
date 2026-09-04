import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    unreadCount: 2,
    notifications: [
      {
        id: "n_1",
        message: "New rate quote received for Order #ORD-4491 from Project44",
        type: "QUOTE_RECEIVED",
        entityType: "Order",
        entityId: "ORD-4491",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "n_2",
        message: "Carrier Samsara Telematics reported 15 min ETA delay on Shipment #SHP-9021",
        type: "EXCEPTION",
        entityType: "Shipment",
        entityId: "SHP-9021",
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  });
}
