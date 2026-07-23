import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  webpack: (config, { isServer }) => {
    // 1. Enable WebAssembly experiments in Webpack
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // 2. Fixes issue with server-side compilation of WASM files in Next.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // 3. Properly route .wasm files to be emitted as assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
      generator: {
        filename: 'static/chunks/[name][ext]',
      },
    });

    return config;
  },
};

export default nextConfig;