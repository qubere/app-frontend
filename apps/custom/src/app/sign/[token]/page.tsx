import { db } from "@/lib/db";
import SignPageClient from "./SignPageClient";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const envelope = await db.poaEnvelope.findFirst({
    where: { providerEnvelopeId: token, provider: "INTERNAL" },
    include: {
      powerOfAttorney: {
        include: {
          importerOfRecord: true,
        },
      },
    },
  });

  if (!envelope) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3 p-8">
          <h1 className="text-2xl font-semibold text-foreground">Signing link not found</h1>
          <p className="text-muted-foreground">
            This link may have expired or already been used. Contact your customs broker if you believe
            this is an error.
          </p>
        </div>
      </div>
    );
  }

  if (envelope.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3 p-8">
          <h1 className="text-2xl font-semibold text-foreground">Already signed</h1>
          <p className="text-muted-foreground">
            This Power of Attorney was already signed on{" "}
            {envelope.completedAt?.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }) ?? "a previous date"}
            . No further action is required.
          </p>
        </div>
      </div>
    );
  }

  const poa = envelope.powerOfAttorney;

  return (
    <SignPageClient
      token={token}
      signerName={envelope.signerName}
      signerRole={envelope.signerRole}
      signerTitle={envelope.signerTitle ?? undefined}
      importerName={poa.importerOfRecord?.name ?? poa.grantedByEntity}
      grantedByEntity={poa.grantedByEntity}
      expirationDate={poa.expirationDate?.toISOString() ?? null}
    />
  );
}
