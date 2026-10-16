import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Fotos de celular costumam passar de 1 MB — limite padrão das Server Actions.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/app/story/:shareToken",
        destination: "/story/:shareToken",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
