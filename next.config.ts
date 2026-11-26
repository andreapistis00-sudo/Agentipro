import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permette più istanze dev/build in parallelo (es. NEXT_DIST_DIR=.next-search)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
