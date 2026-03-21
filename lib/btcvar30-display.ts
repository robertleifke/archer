import type { BtcConvexPerpSnapshot, MarketSemantics } from "@/lib/trading.types";

/**
 * BTCVAR30 engine prices are variance-native.
 * The matching/settlement engine may emit raw ticks, while the UI must always display
 * the normalized 30-day implied volatility equivalent.
 *
 * Invariants:
 * - engine operates in variance
 * - UI displays vol %
 * - never apply sqrt to ticks directly
 * - always normalize before conversion
 */
export const BTCVAR30_TICK_SIZE = 0.0001;

const MAX_REASONABLE_VARIANCE = 5;
const MAX_REASONABLE_VOL_PERCENT = 500;
const MAX_REASONABLE_SPOT_SENSITIVITY_BTC = 250;

const BTCVAR30_SEMANTICS = {
  defaultChartMode: "Vol",
  displayName: "BTC 30D Implied Volatility Perpetual",
  displaySemantics: "volatility",
  infoHint: "Submitted in variance, displayed in volatility",
  marketTag: "30D Implied Vol",
  priceSemantics: "variance",
  shortDisplayName: "BTC 30D Vol Perp",
  tickSize: BTCVAR30_TICK_SIZE,
} as const satisfies MarketSemantics;

type EngineValueSource = "auto" | "ticks" | "variance";

type ExposureDisplayInput = {
  markVariance: number;
  varianceExposurePerPoint01Usd: number;
};

function warnOutOfRange(label: string, value: number) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error(`[BTCVAR30] ${label}: ${value}`);
}

function sanitizeVariance(variance: number) {
  if (!Number.isFinite(variance)) {
    warnOutOfRange("Non-finite variance", variance);
    return 0;
  }

  if (variance < 0) {
    warnOutOfRange("Negative variance", variance);
    return 0;
  }

  if (variance > MAX_REASONABLE_VARIANCE) {
    warnOutOfRange("Suspiciously large normalized variance", variance);
  }

  return variance;
}

function sanitizeVolPercent(volPercent: number) {
  if (!Number.isFinite(volPercent)) {
    warnOutOfRange("Non-finite vol percent", volPercent);
    return 0;
  }

  if (volPercent > MAX_REASONABLE_VOL_PERCENT) {
    warnOutOfRange("Suspiciously large implied vol percent", volPercent);
  }

  return volPercent;
}

export function getBtcVar30Semantics() {
  return BTCVAR30_SEMANTICS;
}

export function ticksToVariance(ticks: number): number {
  if (!Number.isFinite(ticks)) {
    warnOutOfRange("Non-finite ticks", ticks);
    return 0;
  }

  return ticks * BTCVAR30_TICK_SIZE;
}

export function normalizeVariance(value: number, source: EngineValueSource = "auto"): number {
  if (source === "ticks") {
    return sanitizeVariance(ticksToVariance(value));
  }

  if (source === "variance") {
    return sanitizeVariance(value);
  }

  const normalizedValue = Math.abs(value) > MAX_REASONABLE_VARIANCE ? ticksToVariance(value) : value;
  return sanitizeVariance(normalizedValue);
}

export function varianceToVolPercent(variance: number): number {
  const normalizedVariance = sanitizeVariance(variance);
  return sanitizeVolPercent(Math.sqrt(normalizedVariance) * 100);
}

export function ticksToVolPercent(ticks: number): number {
  return varianceToVolPercent(ticksToVariance(ticks));
}

export function volPercentToVariance(volPercent: number) {
  const sanitizedVolPercent = sanitizeVolPercent(Math.max(volPercent, 0));
  return (sanitizedVolPercent / 100) ** 2;
}

export function formatVolPercentFromVariance(variance: number, digits = 2) {
  return `${varianceToVolPercent(variance).toFixed(digits)}%`;
}

export function formatVolPercentFromTicks(ticks: number, digits = 2) {
  return `${ticksToVolPercent(ticks).toFixed(digits)}%`;
}

export function formatVariancePrice(variance: number, digits = 4) {
  return normalizeVariance(variance, "variance").toFixed(digits);
}

export function displayedVolSpread(bestBidVariance: number, bestAskVariance: number) {
  const normalizedBidVariance = normalizeVariance(bestBidVariance, "variance");
  const normalizedAskVariance = normalizeVariance(bestAskVariance, "variance");

  return Math.max(varianceToVolPercent(normalizedAskVariance) - varianceToVolPercent(normalizedBidVariance), 0);
}

export function formatDisplayedVolSpread(bestBidVariance: number, bestAskVariance: number, digits = 2) {
  return `${displayedVolSpread(bestBidVariance, bestAskVariance).toFixed(digits)} pts`;
}

export function formatFundingVarianceBps(fundingRateBps: number, digits = 2) {
  if (!Number.isFinite(fundingRateBps)) {
    warnOutOfRange("Non-finite funding bps", fundingRateBps);
    return "Funding (variance): --";
  }

  return `Funding (variance): ${fundingRateBps.toFixed(digits)} bps`;
}

export function getBtcVar30ExposureDisplay({
  markVariance,
  varianceExposurePerPoint01Usd,
}: ExposureDisplayInput) {
  const normalizedMarkVariance = normalizeVariance(markVariance, "variance");
  const normalizedVarianceExposure = Number.isFinite(varianceExposurePerPoint01Usd)
    ? varianceExposurePerPoint01Usd
    : 0;
  const variancePerOneVolPoint = Math.sqrt(normalizedMarkVariance) / 50;
  const volExposurePerPointUsd = (normalizedVarianceExposure / 0.01) * variancePerOneVolPoint;

  if (!Number.isFinite(volExposurePerPointUsd)) {
    warnOutOfRange("Non-finite vol exposure", volExposurePerPointUsd);
  }

  return {
    variancePerOneVolPoint,
    varianceExposurePerPoint01Usd: normalizedVarianceExposure,
    volExposurePerPointUsd: Number.isFinite(volExposurePerPointUsd) ? volExposurePerPointUsd : 0,
  };
}

export function formatExposureUsd(value: number, suffix: string, digits = 0) {
  if (!Number.isFinite(value)) {
    warnOutOfRange("Non-finite exposure display", value);
    return "\u2014";
  }

  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} ${suffix}`;
}

export function getDisplaySpotSensitivityBtc(sensitivityBtc: number) {
  if (!Number.isFinite(sensitivityBtc)) {
    warnOutOfRange("Non-finite spot sensitivity", sensitivityBtc);
    return null;
  }

  if (Math.abs(sensitivityBtc) > MAX_REASONABLE_SPOT_SENSITIVITY_BTC) {
    return null;
  }

  return sensitivityBtc;
}

export function normalizeEnginePriceToVariance(value: number, source: EngineValueSource = "auto") {
  return normalizeVariance(value, source);
}

export function getBtcVar30DisplayFields({
  indexValue,
  indexValueSource = "auto",
  markValue,
  markValueSource = "auto",
}: {
  indexValue: number;
  indexValueSource?: EngineValueSource;
  markValue: number;
  markValueSource?: EngineValueSource;
}) {
  const indexVariance = normalizeEnginePriceToVariance(indexValue, indexValueSource);
  const markVariance = normalizeEnginePriceToVariance(markValue, markValueSource);
  const markVolPercent = varianceToVolPercent(markVariance);
  const indexVolPercent = varianceToVolPercent(indexVariance);
  const changePercent = indexVolPercent === 0 ? 0 : ((markVolPercent - indexVolPercent) / indexVolPercent) * 100;

  return {
    changePercent,
    displayIndexVol: formatVolPercentFromVariance(indexVariance),
    displayMarkVol: formatVolPercentFromVariance(markVariance),
    indexVariance,
    indexVolPercent,
    markVariance,
    markVolPercent,
    semantics: BTCVAR30_SEMANTICS,
  };
}

export function toBtcVar30Snapshot({
  confidence,
  contractAddress,
  fallbackUsed,
  indexValue,
  indexValueSource = "auto",
  markSource,
  markValue,
  markValueSource = "auto",
  pair,
}: {
  confidence: number;
  contractAddress: string;
  fallbackUsed: boolean;
  indexValue: number;
  indexValueSource?: EngineValueSource;
  markSource: "index_fallback" | "perp";
  markValue: number;
  markValueSource?: EngineValueSource;
  pair: "BTCVAR30-PERP";
}): BtcConvexPerpSnapshot {
  const display = getBtcVar30DisplayFields({
    indexValue,
    indexValueSource,
    markValue,
    markValueSource,
  });

  return {
    confidence,
    contractAddress,
    display_name: BTCVAR30_SEMANTICS.displayName,
    display_semantics: BTCVAR30_SEMANTICS.displaySemantics,
    displayIndexVolPct: display.indexVolPercent,
    displayMarkVolPct: display.markVolPercent,
    fallbackUsed,
    indexVariance: display.indexVariance,
    markSource,
    markVariance: display.markVariance,
    pair,
    price_semantics: BTCVAR30_SEMANTICS.priceSemantics,
    short_display_name: BTCVAR30_SEMANTICS.shortDisplayName,
    tick_size: BTCVAR30_TICK_SIZE,
  };
}
