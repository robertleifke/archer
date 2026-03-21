"use client";

import { useEffect, useRef } from "react";
import { formatVolPercentFromVariance } from "@/lib/btcvar30-display";

export function LiveTabTitle({
  pair,
  price,
}: {
  pair: string;
  price: number | null;
}) {
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    let formatted = "--";

    if (price !== null) {
      if (pair === "BTCVAR30-PERP") {
        formatted = formatVolPercentFromVariance(price);
      } else {
        formatted = new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 2,
        }).format(price);
      }
    }

    let prefix = "";

    if (price !== null && prevPriceRef.current !== null) {
      if (price > prevPriceRef.current) {
        prefix = "↑ ";
      } else if (price < prevPriceRef.current) {
        prefix = "↓ ";
      }
    }

    document.title = `${prefix}${formatted} ${pair} | Archer`;

    prevPriceRef.current = price;
  }, [pair, price]);

  return null;
}
