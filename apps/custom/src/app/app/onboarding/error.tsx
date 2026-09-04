"use client";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <h2 className="text-xl font-semibold text-ink">Failed to load onboarding</h2>
      <p className="text-ink-muted text-sm max-w-md">
        {error.digest
          ? `An error occurred (${error.digest}). This is usually a database migration issue — run \`prisma migrate deploy\` against the demo database.`
          : error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90"
      >
        Try again
      </button>
    </div>
  );
}
