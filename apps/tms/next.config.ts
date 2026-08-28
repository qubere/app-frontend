import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth", "@qubere/storage"],
  serverExternalPackages: ["@prisma/client", "@google-cloud/storage"],
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
