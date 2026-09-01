import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth", "@qubere/storage", "@qubere/tracking", "@qubere/tracking-platform"],
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
