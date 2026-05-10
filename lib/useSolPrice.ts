"use client";

import { useState, useEffect } from "react";

// CoinGecko free API — no key needed
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

let cachedPrice: number | null = null;
let lastFetch = 0;

export function useSolPrice() {
  const [price, setPrice] = useState<number | null>(cachedPrice);

  useEffect(() => {
    const now = Date.now();
    // Refresh at most every 60s
    if (cachedPrice && now - lastFetch < 60_000) {
      setPrice(cachedPrice);
      return;
    }

    fetch(COINGECKO_URL)
      .then((r) => r.json())
      .then((data) => {
        const p = data?.solana?.usd as number | undefined;
        if (p) {
          cachedPrice = p;
          lastFetch = Date.now();
          setPrice(p);
        }
      })
      .catch(() => {
        // Fallback mock price if API unavailable
        if (!cachedPrice) {
          cachedPrice = 145;
          setPrice(145);
        }
      });
  }, []);

  return price;
}
