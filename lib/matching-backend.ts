import "server-only";

import { normalizeEnginePriceToVariance } from "@/lib/btcvar30-display";
import type {
  ConvexPerpOrderCancellation,
  ConvexPerpOrderSubmission,
  ManagedConvexOrder,
  MatchingBackendCreateOrderRequest,
  MatchingBackendOrderBookSnapshot,
  OrderBookLevel,
} from "@/lib/trading.types";

const DEFAULT_MATCHING_BACKEND_URL = "http://127.0.0.1:8080";
const DEFAULT_MATCHING_BACKEND_ORDER_PATH = "/v1/orders";
const DEFAULT_MATCHING_BACKEND_CANCEL_PATH = "/v1/orders/cancel";
const PRICE_SCALE = 1_000_000_000_000_000_000n;
const SIZE_SCALE = 100_000_000n;

type MatchingBackendOrder = {
  CreatedAt?: string;
  DesiredAmount: string;
  FilledAmount: string;
  LimitPrice: string;
  Nonce?: string;
  OrderID?: string;
  OwnerAddress?: string;
  Side?: "buy" | "sell";
  Status?: string;
};

type MatchingBackendBookResponse = {
  asks: MatchingBackendOrder[] | null;
  asset_address: string;
  bids: MatchingBackendOrder[] | null;
  market: string;
  sub_id: string;
};

type FetchErrorWithCause = Error & {
  cause?: {
    code?: string;
  };
};

function createEmptyOrderBookSnapshot(): MatchingBackendOrderBookSnapshot {
  return {
    asks: [],
    assetAddress: "",
    bids: [],
    market: "BTCVAR30-PERP",
    source: "matching-backend",
    subId: "",
    updatedAt: new Date().toISOString(),
  };
}

function getMatchingBackendUrl() {
  return process.env.MATCHING_BACKEND_URL?.trim() || DEFAULT_MATCHING_BACKEND_URL;
}

function getMatchingBackendEndpoint(path: string) {
  return new URL(path, getMatchingBackendUrl()).toString();
}

function getMatchingBackendOrderPath() {
  return process.env.MATCHING_BACKEND_ORDER_PATH?.trim() || DEFAULT_MATCHING_BACKEND_ORDER_PATH;
}

function getMatchingBackendCancelPath() {
  return process.env.MATCHING_BACKEND_CANCEL_PATH?.trim() || DEFAULT_MATCHING_BACKEND_CANCEL_PATH;
}

function isMatchingBackendUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as FetchErrorWithCause).cause;
  return (
    cause?.code === "ECONNREFUSED" ||
    cause?.code === "ENOTFOUND" ||
    cause?.code === "EHOSTUNREACH"
  );
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
  return normalizeEnginePriceToVariance(scaleToDisplayNumber(BigInt(order.LimitPrice), PRICE_SCALE, 18));
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

function toManagedOrder(order: MatchingBackendOrder): ManagedConvexOrder | null {
  if (
    !order.OrderID ||
    !order.OwnerAddress ||
    !order.Nonce ||
    !order.Side ||
    !order.CreatedAt ||
    order.Status !== "active"
  ) {
    return null;
  }

  return {
    limitPriceVariance: toDisplayPrice(order),
    nonce: order.Nonce,
    orderId: order.OrderID,
    ownerAddress: order.OwnerAddress,
    side: order.Side,
    sizeBtc: toRemainingSize(order).toFixed(8),
    submittedAt: order.CreatedAt,
  };
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

export async function getBtcConvexOrderBook(): Promise<MatchingBackendOrderBookSnapshot> {
  let response: Response;

  try {
    response = await fetch(getMatchingBackendEndpoint("/v1/book"), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    if (isMatchingBackendUnavailableError(error)) {
      return createEmptyOrderBookSnapshot();
    }

    throw error;
  }

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

export async function getBtcConvexOpenOrders(ownerAddress: string): Promise<ManagedConvexOrder[]> {
  let response: Response;

  try {
    response = await fetch(getMatchingBackendEndpoint("/v1/book"), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    if (isMatchingBackendUnavailableError(error)) {
      return [];
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Matching backend open-orders request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as MatchingBackendBookResponse;
  const normalizedOwner = ownerAddress.toLowerCase();

  return [...(payload.bids ?? []), ...(payload.asks ?? [])]
    .filter((order) => order.OwnerAddress?.toLowerCase() === normalizedOwner)
    .map(toManagedOrder)
    .filter((order) => order !== null)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function submitBtcConvexOrder(
  orderPayload: MatchingBackendCreateOrderRequest,
): Promise<ConvexPerpOrderSubmission> {
  let response: Response;

  try {
    response = await fetch(getMatchingBackendEndpoint(getMatchingBackendOrderPath()), {
      body: JSON.stringify(orderPayload),
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    if (isMatchingBackendUnavailableError(error)) {
      throw new Error("Matching backend order endpoint is unavailable");
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Matching backend order request failed with status ${response.status}`);
  }

  const backend = await response.json().catch(() => null);

  return {
    accepted: true,
    backend,
    orderId: orderPayload.order_id,
    receivedAt: new Date().toISOString(),
    signer: orderPayload.signer_address,
  };
}

export async function cancelBtcConvexOrder({
  nonce,
  ownerAddress,
}: {
  nonce: string;
  ownerAddress: string;
}): Promise<ConvexPerpOrderCancellation> {
  let response: Response;

  try {
    response = await fetch(getMatchingBackendEndpoint(getMatchingBackendCancelPath()), {
      body: JSON.stringify({
        nonce,
        owner_address: ownerAddress,
      }),
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    if (isMatchingBackendUnavailableError(error)) {
      throw new Error("Matching backend cancel endpoint is unavailable");
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Matching backend cancel request failed with status ${response.status}`);
  }

  const backend = await response.json().catch(() => null);

  return {
    accepted: true,
    backend,
    cancelledAt: new Date().toISOString(),
    nonce,
    ownerAddress,
  };
}
