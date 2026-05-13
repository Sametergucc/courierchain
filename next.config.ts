import type { NextConfig } from "next";

/** İstemcide Solana Connection için tam HTTPS proxy URL; boşsa Vercel host veya localhost. */
function publicSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "http://localhost:3000";
}

const siteOrigin = publicSiteOrigin();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SOLANA_MAINNET_PROXY_URL: `${siteOrigin}/api/solana-mainnet`,
  },
  turbopack: {
    resolveAlias: {
      "pino-pretty": "./node_modules/pino-pretty/index.js",
    },
  },
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
  },
};

export default nextConfig;
