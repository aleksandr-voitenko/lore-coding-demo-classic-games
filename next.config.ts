import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.125.2.124"],
  reactCompiler: true,
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
