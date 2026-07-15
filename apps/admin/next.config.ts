import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: false,
  },
  transpilePackages: ["@platform/agent", "@platform/ai-client", "@platform/core", "@platform/database", "@platform/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
