import {
  getBtcVar30ExposureDisplay,
  varianceToVolPercent,
  volPercentToVariance,
} from "@/lib/btcvar30-display";
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

const BREAK_EVEN_SEARCH_STEPS = [0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2] as const;

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

export function getGammaPer1PctMove(
  convexNotionalUsd: number,
  markPrice: number,
  referencePrice: number,
) {
  return ((2 * convexNotionalUsd) / referencePrice ** 2) * (markPrice * 0.01);
}

export function getDeltaNotionalUsd(convexNotionalUsd: number, markPrice: number, referencePrice: number) {
  return getDeltaEquivalentBtc(convexNotionalUsd, markPrice, referencePrice) * markPrice;
}

export function getConvexityExposurePer1PctSquared(
  convexNotionalUsd: number,
  markPrice: number,
  referencePrice: number,
) {
  return convexNotionalUsd * ((markPrice / referencePrice) ** 2) * 0.0001;
}

export function getEstimatedFundingUsd8h(
  convexNotionalUsd: number,
  side: "buy" | "sell",
  fundingRateBps = 1,
) {
  const signedFunding = (convexNotionalUsd * fundingRateBps) / 10_000;
  return side === "buy" ? -signedFunding : signedFunding;
}

function findBreakEvenMove(
  getNetScenarioPnl: (movePercent: number) => number,
  direction: -1 | 1,
  currentNet: number,
) {
  let previousMove = 0;

  for (const step of BREAK_EVEN_SEARCH_STEPS) {
    const nextMove = step * direction;
    const nextNet = getNetScenarioPnl(nextMove);

    if (nextNet >= 0) {
      let low = Math.min(previousMove, nextMove);
      let high = Math.max(previousMove, nextMove);

      for (let iteration = 0; iteration < 18; iteration += 1) {
        const midpoint = (low + high) / 2;
        const midpointNet = getNetScenarioPnl(midpoint);

        if (midpointNet >= 0) {
          high = midpoint;
        } else {
          low = midpoint;
        }
      }

      return Math.abs(high);
    }

    previousMove = nextMove;
  }

  return currentNet > 0 ? 0 : Number.POSITIVE_INFINITY;
}

export function getBreakEvenMovePercent(
  convexNotionalUsd: number,
  entryReferencePrice: number,
  markPrice: number,
  side: "buy" | "sell",
  estimatedFundingUsd8h: number,
) {
  if (convexNotionalUsd <= 0 || entryReferencePrice <= 0 || markPrice <= 0) {
    return 0;
  }

  // This remains a terminal-friendly placeholder until real fee/funding/slippage pricing is wired in.
  // We solve for the smallest absolute move from the current mark where net PnL turns non-negative
  // after subtracting one funding interval from long-convexity orders or adding it to short-convexity orders.
  function getNetScenarioPnl(movePercent: number) {
    const scenarioMark = markPrice * (1 + movePercent);
    return (
      getConvexPnlUsd(convexNotionalUsd, entryReferencePrice, scenarioMark, side) +
      estimatedFundingUsd8h
    );
  }

  const currentNet = getNetScenarioPnl(0);

  if (currentNet > 0) {
    return 0;
  }

  const bestMove = Math.min(
    findBreakEvenMove(getNetScenarioPnl, -1, currentNet),
    findBreakEvenMove(getNetScenarioPnl, 1, currentNet),
  );

  if (!Number.isFinite(bestMove)) {
    return 20;
  }

  return Math.max(roundTo(bestMove * 100, 2), 0.01);
}

export function getConvexPnlUsd(
  convexNotionalUsd: number,
  entryReferencePrice: number,
  markPrice: number,
  side: "buy" | "sell",
) {
  const signedPayoff = convexNotionalUsd * (markPrice - entryReferencePrice);

  return side === "buy" ? signedPayoff : -signedPayoff;
}

export function getConvexScenarioPnl(
  convexNotionalUsd: number,
  entryReferencePrice: number,
  markPrice: number,
  side: "buy" | "sell",
  estimatedFundingUsd8h: number,
) {
  const markVolPercent = varianceToVolPercent(markPrice);
  const volScenarios = [5, -5, 10, -10].map((volShift) => {
    const scenarioVolPercent = Math.max(markVolPercent + volShift, 0);
    const scenarioVariance = volPercentToVariance(scenarioVolPercent);

    return {
      changeLabel: `Vol ${volShift > 0 ? "+" : ""}${volShift} pts`,
      displayValue: `${scenarioVolPercent.toFixed(2)}%`,
      pnlUsd:
        getConvexPnlUsd(convexNotionalUsd, entryReferencePrice, scenarioVariance, side) +
        estimatedFundingUsd8h,
      spotPrice: roundTo(scenarioVariance, 4),
    };
  });

  const unchangedScenario = {
    changeLabel: "BTC unchanged",
    displayValue: `${markVolPercent.toFixed(2)}%`,
    pnlUsd:
      getConvexPnlUsd(convexNotionalUsd, entryReferencePrice, markPrice, side) +
      estimatedFundingUsd8h,
    spotPrice: roundTo(markPrice, 4),
  };

  return [...volScenarios, unchangedScenario];
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
  const estimatedFundingUsd8h = getEstimatedFundingUsd8h(convexNotionalUsd, side, 1);
  const markVolPercent = varianceToVolPercent(markPrice);
  const referenceVolPercent = varianceToVolPercent(referencePrice);
  const currentPnlUsd = getConvexPnlUsd(convexNotionalUsd, entryReferencePrice, markPrice, side);
  const nextVariancePointPnlUsd = getConvexPnlUsd(
    convexNotionalUsd,
    entryReferencePrice,
    markPrice + 0.01,
    side,
  );
  const exposureDisplay = getBtcVar30ExposureDisplay({
    markVariance: markPrice,
    varianceExposurePerPoint01Usd: nextVariancePointPnlUsd - currentPnlUsd,
  });

  return {
    breakEvenMovePercent: getBreakEvenMovePercent(
      convexNotionalUsd,
      entryReferencePrice,
      markPrice,
      side,
      estimatedFundingUsd8h,
    ),
    convexNotionalUsd,
    convexityExposurePer1PctSquared: getConvexityExposurePer1PctSquared(
      convexNotionalUsd,
      markPrice,
      referencePrice,
    ),
    convexUnits: getConvexUnitsFromNotional(convexNotionalUsd, referencePrice),
    deltaNotionalUsd: getDeltaNotionalUsd(convexNotionalUsd, markPrice, referencePrice),
    deltaEquivalentBtc: getDeltaEquivalentBtc(convexNotionalUsd, markPrice, referencePrice),
    entryReferencePrice,
    estimatedFundingUsd8h,
    gammaPer1PctMove: getGammaPer1PctMove(convexNotionalUsd, markPrice, referencePrice),
    gammaPer1kMove: getGammaPer1kMove(convexNotionalUsd, referencePrice),
    markVariance: markPrice,
    markPrice,
    markVolPercent,
    pnlUsd: currentPnlUsd,
    referenceVariance: referencePrice,
    referenceVolPercent,
    scenarioPnl: getConvexScenarioPnl(
      convexNotionalUsd,
      entryReferencePrice,
      markPrice,
      side,
      estimatedFundingUsd8h,
    ),
    side,
    varianceExposurePerPoint01Usd: exposureDisplay.varianceExposurePerPoint01Usd,
    volExposurePerPointUsd: exposureDisplay.volExposurePerPointUsd,
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
    const askPrice = roundTo(midPrice * (1 + askDistanceBps / 10_000), 4);
    const bidPrice = roundTo(midPrice * (1 - bidDistanceBps / 10_000), 4);

    askTotal += askSize;
    bidTotal += bidSize;

    asks.push({
      convexUnits: roundTo(getConvexUnitsFromNotional(askSize * referencePrice, referencePrice), 2),
      deltaEquivalent: roundTo(
        getDeltaEquivalentBtc(askSize * referencePrice, askPrice, referencePrice),
        3,
      ),
      distanceBps: roundTo(askDistanceBps, 1),
      gammaPer1PctMove: roundTo(
        getGammaPer1PctMove(askSize * referencePrice, askPrice, referencePrice),
        3,
      ),
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
      gammaPer1PctMove: roundTo(
        getGammaPer1PctMove(bidSize * referencePrice, bidPrice, referencePrice),
        3,
      ),
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
