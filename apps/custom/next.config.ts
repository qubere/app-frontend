import type { NextConfig } from "next";
import { execSync } from "child_process";

function resolveGitCommitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

interface DeploymentEntry {
  hash: string;
  date: string;
  summary: string;
  author: string;
}

function resolveDeploymentLog(): string {
  try {
    // Each line: <hash>\x1f<iso-date>\x1f<subject>\x1f<author>
    const raw = execSync(
      "git log --no-merges -20 --format=%H%x1f%aI%x1f%s%x1f%an",
      { maxBuffer: 512 * 1024 }
    )
      .toString()
      .trim();

    const entries: DeploymentEntry[] = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, summary, author] = line.split("\x1f");
        return { hash: hash.slice(0, 7), date, summary, author };
      });

    return JSON.stringify(entries);
  } catch {
    return "[]";
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  // @qubere/db is a local TS workspace package (packages/db), not a pre-built
  // npm package -- Next must compile its TypeScript source rather than
  // treating it as opaque runtime code. App Router + Turbopack/webpack
  // transpile workspace packages automatically in most cases, but this is
  // kept explicit since it's a hard requirement for the build to work.
  transpilePackages: ["@qubere/db", "@qubere/billing", "@qubere/auth"],
  serverExternalPackages: ["@prisma/client"],
  env: {
    NEXT_PUBLIC_GIT_COMMIT_SHA: resolveGitCommitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_DEPLOYMENT_LOG: resolveDeploymentLog(),
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
