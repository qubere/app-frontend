import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth", "@qubere/storage", "@qubere/entry-proof"],
  serverExternalPackages: ["@prisma/client", "@google-cloud/storage"],
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    // Keep all auth UI on our own Qubere-branded /sign-in route instead of the
    // unstyled Clerk Account Portal at accounts.qubere.ai. Baked in here (rather
    // than left to per-env Vercel vars) so a missing var can never bounce
    // signed-out visitors off-domain again.
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/",
  },
  async rewrites() {
    return [
      {
        source: "/__clerk/:path*",
        destination: "https://clerk.qubere.ai/:path*",
      },
    ];
  },
};

export default nextConfig;
