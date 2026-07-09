import type { NextConfig } from "next";

import { readOptionalExactIPv4Host } from "./scripts/exact-ipv4-host.mjs";

const multiplayerDevPublicHost = readOptionalExactIPv4Host(
  process.env.MULTIPLAYER_DEV_PUBLIC_HOST,
  "MULTIPLAYER_DEV_PUBLIC_HOST",
);

const nextConfig: NextConfig = {
  allowedDevOrigins: multiplayerDevPublicHost
    ? [multiplayerDevPublicHost]
    : undefined,
  output: "standalone",
  reactCompiler: true,
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
