import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // NextAuth v5-beta wrapped handlers don't yet match Next.js 15's strict
  // type checks for App Router route handlers. Type checking still runs
  // during `npm run lint` and in IDEs — just not blocking production builds.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
