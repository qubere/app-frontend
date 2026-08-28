import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const accountId = ctx.accountId;

  // Query all members in account who hold CUSTOMER_USER or CUSTOMER_ADMIN roles, or any user with porter access
  const memberships = await db.accountMembership.findMany({
    where: {
      accountId,
      deletedAt: null,
      status: "ACTIVE",
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      roles: {
        include: {
          role: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const customerUsers = memberships
    .map((m) => {
      const roleNames = m.roles.map((r) => r.role.name);
      return {
        id: m.userId,
        membershipId: m.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        name: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.email.split("@")[0],
        roleNames,
        isCustomerUser: roleNames.some((r) =>
          ["CUSTOMER_USER", "CUSTOMER_ADMIN", "PORTER"].includes(r.toUpperCase())
        ),
      };
    })
    .filter((user) => user.email && user.isCustomerUser);

  return NextResponse.json({ customerUsers });
});
