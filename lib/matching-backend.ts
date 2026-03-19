import "server-only";

import type { MatchingBackendOrderBookSnapshot, OrderBookLevel } from "@/lib/trading.types";

const DEFAULT_MATCHING_BACKEND_URL = "http://127.0.0.1:8080";
const PRICE_SCALE = 1_000_000_000_000_000_000n;
const SIZE_SCALE = 100_000_000n;

type MatchingBackendOrder = {
  DesiredAmount: string;
  FilledAmount: string;
  LimitPrice: string;
};

type MatchingBackendBookResponse = {
  asks: MatchingBackendOrder[] | null;
  asset_address: string;
  bids: MatchingBackendOrder[] | null;
  market: string;
  sub_id: string;
};

function getMatchingBackendUrl() {
  return process.env.MATCHING_BACKEND_URL?.trim() || DEFAULT_MATCHING_BACKEND_URL;
}

function scaleToDisplayNumber(value: bigint, scale: bigint, fractionDigits: number) {
  const whole = value / scale;
  const fraction = value % scale;

  return Number(whole) + Number(fraction) / 10 ** fractionDigits;
}

function toRemainingSize(order: MatchingBackendOrder) {
  const desiredAmount = BigInt(order.DesiredAmount);
  const filledAmount = BigInt(order.FilledAmount);
  const remainingAmount = desiredAmount - filledAmount;

  if (remainingAmount <= 0n) {
    return 0;
  }

  return scaleToDisplayNumber(remainingAmount, SIZE_SCALE, 8);
}

function toDisplayPrice(order: MatchingBackendOrder) {
  return scaleToDisplayNumber(BigInt(order.LimitPrice), PRICE_SCALE, 18);
}

function buildLevels(orders: MatchingBackendOrder[] | null | undefined) {
  const levelsByPrice = new Map<number, number>();

  if (!orders?.length) {
    return levelsByPrice;
  }

  for (const order of orders) {
    const size = toRemainingSize(order);

    if (size <= 0) {
      continue;
    }

    const price = toDisplayPrice(order);
    levelsByPrice.set(price, (levelsByPrice.get(price) ?? 0) + size);
  }

  return levelsByPrice;
}

function toOrderBookLevels(levelsByPrice: Map<number, number>, side: "asks" | "bids") {
  const orderedEntries = [...levelsByPrice.entries()].sort(([leftPrice], [rightPrice]) =>
    side === "asks" ? leftPrice - rightPrice : rightPrice - leftPrice,
  );

  let runningTotal = 0;

  return orderedEntries.map(([price, size]) => {
    runningTotal += size;

    return {
      price,
      size,
      total: runningTotal,
    } satisfies OrderBookLevel;
  });
}

export async function getBtcSquaredOrderBook(): Promise<MatchingBackendOrderBookSnapshot> {
  const response = await fetch(`${getMatchingBackendUrl()}/v1/book`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Matching backend book request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as MatchingBackendBookResponse;

  return {
    asks: toOrderBookLevels(buildLevels(payload.asks), "asks"),
    assetAddress: payload.asset_address,
    bids: toOrderBookLevels(buildLevels(payload.bids), "bids"),
    market: payload.market,
    source: "matching-backend",
    subId: payload.sub_id,
    updatedAt: new Date().toISOString(),
  };
}
