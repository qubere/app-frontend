import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth"],
  serverExternalPackages: ["@prisma/client"],
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
