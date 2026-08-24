import type { NextConfig } from "next";

const defaultPublishableKey = "pk_test_Y29udGVudC1ibHVlZ2lsbC02OC5jbGVyay5hY2NvdW50cy5kZXYk";
const defaultSecretKey = "sk_test_if3HmwoOtfftlho92gPL1p6wp7JVMRIWVjpNaDc3DS";

const nextConfig: NextConfig = {
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth"],
  serverExternalPackages: ["@prisma/client"],
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || defaultPublishableKey,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || defaultSecretKey,
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
