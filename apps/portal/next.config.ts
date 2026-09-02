import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth", "@qubere/storage", "@qubere/entry-proof"],
  serverExternalPackages: ["@prisma/client", "@google-cloud/storage"],
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
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
