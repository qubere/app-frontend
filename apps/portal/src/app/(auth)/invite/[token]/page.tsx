import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@qubere/db";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ErrorCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] px-4">
      <Card className="max-w-md w-full p-8 text-center rounded-2xl shadow-xl space-y-4">
        <h1 className="text-xl font-bold text-[#1D1D1F]">{title}</h1>
        <p className="text-sm text-[#86868B] leading-relaxed">{children}</p>
        <Link href="/sign-in" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "inline-block")}>
          Go to Sign In
        </Link>
      </Card>
    </div>
  );
}

export default async function InviteAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { account: true, role: true, client: true },
  });

  if (
    !invitation ||
    invitation.purpose !== "CUSTOMER_PORTAL" ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt < new Date()
  ) {
    return (
      <ErrorCard title="Invalid or Expired Invitation">
        This invitation link is invalid, expired, or has already been accepted. Ask your
        customs broker to send a new one.
      </ErrorCard>
    );
  }

  const clerkUser = await currentUser();

  // Not signed in yet — send them through Clerk, then back here to accept.
  if (!clerkUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] px-4">
        <Card className="max-w-md w-full p-8 text-center rounded-2xl shadow-xl space-y-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-[#0071E3] items-center justify-center text-white font-extrabold text-3xl shadow-md mx-auto">
            Q
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Accept Portal Invitation</h1>
            <p className="text-[#86868B] text-sm mt-3 leading-relaxed">
              <strong className="text-[#1D1D1F]">{invitation.account.name}</strong> invited you to
              track shipments, entry summaries, documents, and invoices for{" "}
              <strong className="text-[#1D1D1F]">{invitation.client?.name || "your organization"}</strong>.
            </p>
            <p className="text-xs text-[#86868B] font-mono mt-2">{invitation.email}</p>
          </div>
          <div className="space-y-3">
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
            >
              Sign in &amp; accept
            </Link>
            <p className="text-[11px] text-[#86868B]">
              First time here? Use the password-setup link in your invitation email, then return
              to this page.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const signedInEmail = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase().trim();
  const invitedEmail = invitation.email.toLowerCase().trim();

  // A leaked token must not grant access to a different identity.
  if (!signedInEmail || signedInEmail !== invitedEmail) {
    return (
      <ErrorCard title="Email Mismatch">
        This invitation was sent to <strong className="text-[#1D1D1F]">{invitation.email}</strong>, but
        you are signed in as <strong className="text-[#1D1D1F]">{signedInEmail || "another account"}</strong>.
        Sign in with the invited email address.
      </ErrorCard>
    );
  }

  // Accept inside one transaction — re-check status/expiry to avoid a TOCTOU race,
  // then provision the User row (portal users are often brand new), the account
  // membership + role, and the client-scope assignment.
  // See docs/plans/review/CUSTOMER-PORTAL-PR97-REVIEW.md (P1-1).
  await db.$transaction(async (tx) => {
    const fresh = await tx.invitation.findUnique({ where: { id: invitation.id } });
    if (!fresh || fresh.status !== "PENDING" || fresh.expiresAt < new Date()) {
      return;
    }

    let user = await tx.user.findFirst({ where: { email: invitedEmail, deletedAt: null } });
    if (!user) {
      user = await tx.user.create({
        data: {
          clerkUserId: clerkUser.id,
          email: invitedEmail,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
        },
      });
    } else if (user.clerkUserId !== clerkUser.id) {
      user = await tx.user.update({ where: { id: user.id }, data: { clerkUserId: clerkUser.id } });
    }

    const membership = await tx.accountMembership.upsert({
      where: { accountId_userId: { accountId: invitation.accountId, userId: user.id } },
      update: { status: "ACTIVE" },
      create: { accountId: invitation.accountId, userId: user.id, status: "ACTIVE" },
    });

    await tx.accountMembershipRole.upsert({
      where: {
        accountMembershipId_roleId: { accountMembershipId: membership.id, roleId: invitation.roleId },
      },
      update: {},
      create: { accountMembershipId: membership.id, roleId: invitation.roleId },
    });

    if (invitation.clientId) {
      await tx.userClientAssignment.upsert({
        where: { userId_clientId: { userId: user.id, clientId: invitation.clientId } },
        update: {},
        create: { userId: user.id, clientId: invitation.clientId },
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    await tx.auditLog.create({
      data: {
        accountId: invitation.accountId,
        userId: user.id,
        actorUserId: user.id,
        effectiveUserId: user.id,
        action: "PORTAL_INVITATION_ACCEPT",
        entity: "Invitation",
        entityId: invitation.id,
        clientId: invitation.clientId,
        newValue: { email: invitedEmail, roleId: invitation.roleId },
        source: "PORTAL_UI",
      },
    });
  });

  redirect("/");
}
