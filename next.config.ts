import { readdirSync } from "node:fs";
import type { NextConfig } from "next";

// Two editions from one codebase (src/lib/edition.ts):
// - hosted (default): the site on Vercel, Supabase auth + sync.
// - desktop (NEXT_PUBLIC_EDITION=desktop): a static export the Mac app's Go
//   service serves (desktop/). Hosted-only routes are named *.hosted.tsx /
//   *.hosted.ts and only count as routes in the hosted build
//   (pageExtensions); modules that differ are @edition/<name>, pointed at
//   src/edition/<edition>/ here, so the export can't contain Supabase code.
const desktop = process.env.NEXT_PUBLIC_EDITION === "desktop";
const edition = desktop ? "desktop" : "hosted";
const editionAlias = Object.fromEntries(
  readdirSync("./src/edition/hosted").map((f) => [`@edition/${f.replace(/\.tsx?$/, "")}`, `./src/edition/${edition}/${f}`]),
);

const hostedOnly: NextConfig = {
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

const nextConfig: NextConfig = desktop
  ? {
      output: "export",
      images: { unoptimized: true },
      pageExtensions: ["tsx", "ts"],
      turbopack: { resolveAlias: editionAlias },
    }
  : {
      ...hostedOnly,
      pageExtensions: ["tsx", "ts", "hosted.tsx", "hosted.ts"],
      turbopack: { resolveAlias: editionAlias },
    };

export default nextConfig;
