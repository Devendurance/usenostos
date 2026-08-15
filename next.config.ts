import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next-build",
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    cpus: 1,
    workerThreads: true,
  },
};

export default nextConfig;
