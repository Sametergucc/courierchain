import { NextRequest, NextResponse } from "next/server";
import {
  MAINNET_RPC_UPSTREAM_DEFAULT,
  MAINNET_RPC_UPSTREAM_FALLBACKS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin");
  return {
    "Content-Type": "application/json; charset=utf-8",
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        }
      : { "Access-Control-Allow-Origin": "*" }),
  };
}

function upstreamUrls(): string[] {
  const fromEnv = [
    process.env.MAINNET_RPC_UPSTREAM?.trim(),
    process.env.SOLANA_MAINNET_RPC_UPSTREAM?.trim(),
  ].filter(Boolean) as string[];
  return [
    ...fromEnv,
    MAINNET_RPC_UPSTREAM_DEFAULT,
    ...MAINNET_RPC_UPSTREAM_FALLBACKS,
  ].filter((u, i, a) => a.indexOf(u) === i);
}

function shouldTryNextUpstream(status: number, body: string): boolean {
  if (status >= 500 || status === 401 || status === 403 || status === 429 || status === 408) {
    return true;
  }
  // Bazı sağlayıcılar HTTP 200 dönüp gövdede plan/anahtar hatası verir (-32052 vb.)
  if (
    /\b(-32052|API key is not allowed|not allowed to access blockchain)\b/i.test(body)
  ) {
    return true;
  }
  return false;
}

/**
 * Tarayıcıdan Mainnet RPC — dış RPC’ye doğrudan istek sık engellenir; bu route sunucudan iletir.
 * Tek upstream düşerse sıradakiler denenir (para/bakiye ile ilgili değildir).
 */
export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Invalid body" }, id: null },
      { status: 400 }
    );
  }

  const urls = upstreamUrls();
  let lastErr: unknown;

  for (const upstream of urls) {
    try {
      const res = await fetch(upstream, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      const text = await res.text();
      if (shouldTryNextUpstream(res.status, text)) {
        console.warn(
          "[solana-mainnet proxy] upstream reject, trying next",
          upstream,
          res.status,
          text.slice(0, 120)
        );
        lastErr = new Error(`upstream ${res.status}`);
        continue;
      }
      return new NextResponse(text, {
        status: res.status,
        headers: corsHeaders(request),
      });
    } catch (e) {
      lastErr = e;
      console.warn("[solana-mainnet proxy] upstream fetch failed", upstream, e);
    }
  }

  console.error("[solana-mainnet proxy] all upstreams failed", lastErr);
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Tüm Mainnet RPC denemeleri başarısız. Vercel’de MAINNET_RPC_UPSTREAM’i kaldırıp (ücretsiz sıra devreye girer) veya Helius’ta RPC erişimli geçerli plan/URL kullanın.",
      },
      id: null,
    },
    { status: 502, headers: corsHeaders(request) }
  );
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowHdr =
    request.headers.get("access-control-request-headers") ||
    "Content-Type, Solana-Client";
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            Vary: "Origin",
          }
        : { "Access-Control-Allow-Origin": "*" }),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": allowHdr,
      "Access-Control-Max-Age": "86400",
    },
  });
}
