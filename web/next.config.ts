import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@renderinc/sdk", "workflow-visualizer"],
};

export default nextConfig;
