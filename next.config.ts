import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // HMR handshake fails at 127.0.0.1 otherwise (same host, different name).
  allowedDevOrigins: ["127.0.0.1"],
  // Boards were folded into goals with the same ids (migration 0011).
  async redirects() {
    return [{ source: "/boards/:id", destination: "/goals/:id", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
