import type {
  ConvexExposureMetrics,
  ConvexRiskModel,
  ConvexSizingMode,
  OrderBookLevel,
} from "@/lib/trading.types";

type ConvexExposureInput = {
  entryReferencePrice: number;
  inputValue: number;
  markPrice: number;
  referencePrice: number;
  side: "buy" | "sell";
  sizingMode: ConvexSizingMode;
};

type NonlinearLadderInput = {
  baseTopLevelSize: number;
  convexityRisk: number;
  externalImbalance?: number;
  fundingRateBps: number;
  inventorySkew: number;
  levels: number;
  midPrice: number;
  realizedVol: number;
  referencePrice: number;
};

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getNormalizedSquaredPayoff(markPrice: number, referencePrice: number) {
  return (markPrice / referencePrice) ** 2 - 1;
}

export function getConvexUnitsFromNotional(convexNotionalUsd: number, referencePrice: number) {
  return convexNotionalUsd / referencePrice;
}

export function getConvexNotionalFromSizingMode({
  inputValue,
  markPrice,
  referencePrice,
  sizingMode,
}: Omit<ConvexExposureInput, "entryReferencePrice" | "side">) {
  if (sizingMode === "convex") {
    return inputValue * referencePrice;
  }

  if (sizingMode === "delta") {
    return (inputValue * referencePrice ** 2) / (2 * Math.max(markPrice, 1));
  }

  return inputValue;
}

export function getDeltaEquivalentBtc(convexNotionalUsd: number, markPrice: number, referencePrice: number) {
  return (convexNotionalUsd * 2 * markPrice) / referencePrice ** 2;
}

export function getGammaPer1kMove(convexNotionalUsd: number, referencePrice: number) {
  return ((2 * convexNotionalUsd) / referencePrice ** 2) * 1000;
}

export function getConvexityExposurePer1PctSquared(
  convexNotionalUsd: number,
  markPrice: number,
  referencePrice: number,
) {
  return convexNotionalUsd * ((markPrice / referencePrice) ** 2) * 0.0001;
}

export function getConvexPnlUsd(
  convexNotionalUsd: number,
  entryReferencePrice: number,
  markPrice: number,
  side: "buy" | "sell",
) {
  const signedPayoff =
    convexNotionalUsd * getNormalizedSquaredPayoff(markPrice, entryReferencePrice);

  return side === "buy" ? signedPayoff : -signedPayoff;
}

export function buildConvexExposureMetrics({
  entryReferencePrice,
  inputValue,
  markPrice,
  referencePrice,
  side,
  sizingMode,
}: ConvexExposureInput): ConvexExposureMetrics {
  const convexNotionalUsd = getConvexNotionalFromSizingMode({
    inputValue,
    markPrice,
    referencePrice,
    sizingMode,
  });

  return {
    convexNotionalUsd,
    convexityExposurePer1PctSquared: getConvexityExposurePer1PctSquared(
      convexNotionalUsd,
      markPrice,
      referencePrice,
    ),
    convexUnits: getConvexUnitsFromNotional(convexNotionalUsd, referencePrice),
    deltaEquivalentBtc: getDeltaEquivalentBtc(convexNotionalUsd, markPrice, referencePrice),
    entryReferencePrice,
    gammaPer1kMove: getGammaPer1kMove(convexNotionalUsd, referencePrice),
    markPrice,
    pnlUsd: getConvexPnlUsd(convexNotionalUsd, entryReferencePrice, markPrice, side),
    side,
  };
}

export function deriveExternalImbalance(levels: { asks: OrderBookLevel[]; bids: OrderBookLevel[] } | null) {
  if (!levels) {
    return 0;
  }

  const askTotal = levels.asks.reduce((sum, level) => sum + level.size, 0);
  const bidTotal = levels.bids.reduce((sum, level) => sum + level.size, 0);
  const total = askTotal + bidTotal;

  if (total === 0) {
    return 0;
  }

  return (bidTotal - askTotal) / total;
}

export function getRiskAdjustedSpreadBps({
  convexityRisk,
  externalImbalance = 0,
  fundingRateBps,
  inventorySkew,
  realizedVol,
}: Omit<NonlinearLadderInput, "baseTopLevelSize" | "levels" | "midPrice" | "referencePrice">) {
  return (
    8 +
    realizedVol * 180 +
    convexityRisk * 55 +
    Math.abs(inventorySkew) * 28 +
    Math.abs(fundingRateBps) * 18 +
    Math.abs(externalImbalance) * 22
  );
}

export function buildConvexRiskModel({
  convexityRisk,
  externalImbalance = 0,
  fundingRateBps,
  inventorySkew,
  realizedVol,
}: Omit<NonlinearLadderInput, "baseTopLevelSize" | "levels" | "midPrice" | "referencePrice">): ConvexRiskModel {
  const spreadBps = getRiskAdjustedSpreadBps({
    convexityRisk,
    externalImbalance,
    fundingRateBps,
    inventorySkew,
    realizedVol,
  });

  const topLevelSizeFactor =
    1 /
    (1 + realizedVol * 7 + convexityRisk * 2.5 + Math.abs(inventorySkew) * 2 + Math.abs(externalImbalance));

  return {
    convexityRisk,
    fundingRateBps,
    inventorySkew,
    ladderType: "nonlinear",
    realizedVol,
    spreadBps,
    topLevelSizeFactor,
  };
}

export function generateNonlinearConvexOrderBook({
  baseTopLevelSize,
  convexityRisk,
  externalImbalance = 0,
  fundingRateBps,
  inventorySkew,
  levels,
  midPrice,
  realizedVol,
  referencePrice,
}: NonlinearLadderInput) {
  const riskModel = buildConvexRiskModel({
    convexityRisk,
    externalImbalance,
    fundingRateBps,
    inventorySkew,
    realizedVol,
  });
  const halfSpreadBps = riskModel.spreadBps / 2;
  const askBiasBps = -inventorySkew * 11 - externalImbalance * 7 - fundingRateBps * 0.8;
  const bidBiasBps = inventorySkew * 11 + externalImbalance * 7 + fundingRateBps * 0.8;
  const askDepthBias = 1 + Math.max(0, inventorySkew) * 0.55;
  const bidDepthBias = 1 + Math.max(0, -inventorySkew) * 0.55;
  const asks: OrderBookLevel[] = [];
  const bids: OrderBookLevel[] = [];
  let askTotal = 0;
  let bidTotal = 0;

  // Linear tick generation is intentionally removed here. Levels widen nonlinearly
  // with volatility, inventory skew, and convexity risk before being mapped back to USDC.
  for (let index = 0; index < levels; index += 1) {
    const levelNumber = index + 1;
    const spacingBps =
      halfSpreadBps +
      levelNumber ** 1.55 * (3.2 + realizedVol * 42 + convexityRisk * 8) +
      levelNumber ** 2 * 0.28;
    const askDistanceBps = Math.max(halfSpreadBps * 0.7, spacingBps + askBiasBps);
    const bidDistanceBps = Math.max(halfSpreadBps * 0.7, spacingBps + bidBiasBps);
    const topLevelSize =
      baseTopLevelSize *
      riskModel.topLevelSizeFactor *
      (0.52 + levelNumber ** 1.18 * 0.3);
    const askSize = topLevelSize * askDepthBias;
    const bidSize = topLevelSize * bidDepthBias;
    const askPrice = roundTo(midPrice * (1 + askDistanceBps / 10_000), 2);
    const bidPrice = roundTo(midPrice * (1 - bidDistanceBps / 10_000), 2);

    askTotal += askSize;
    bidTotal += bidSize;

    asks.push({
      convexUnits: roundTo(getConvexUnitsFromNotional(askSize * referencePrice, referencePrice), 2),
      deltaEquivalent: roundTo(
        getDeltaEquivalentBtc(askSize * referencePrice, askPrice, referencePrice),
        3,
      ),
      distanceBps: roundTo(askDistanceBps, 1),
      price: askPrice,
      riskAdjustedSize: roundTo(askSize, 2),
      size: roundTo(askSize, 2),
      total: roundTo(askTotal, 2),
    });

    bids.push({
      convexUnits: roundTo(getConvexUnitsFromNotional(bidSize * referencePrice, referencePrice), 2),
      deltaEquivalent: roundTo(
        getDeltaEquivalentBtc(bidSize * referencePrice, bidPrice, referencePrice),
        3,
      ),
      distanceBps: roundTo(bidDistanceBps, 1),
      price: bidPrice,
      riskAdjustedSize: roundTo(bidSize, 2),
      size: roundTo(bidSize, 2),
      total: roundTo(bidTotal, 2),
    });
  }

  return {
    asks,
    bids,
    riskModel,
  };
}
