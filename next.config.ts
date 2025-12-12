import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  turbopack: {},
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // Enable WebAssembly support for Cardano libraries
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;
