"use client";

import { toViemAccount, usePrivy, useWallets } from "@privy-io/react-auth";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import {
  formatExposureUsd,
  formatFundingVarianceBps,
  formatVariancePrice,
  formatVolPercentFromVariance,
  getDisplaySpotSensitivityBtc,
  getBtcVar30DisplayFields,
  getBtcVar30Semantics,
  normalizeEnginePriceToVariance,
  formatDisplayedVolSpread,
  varianceToVolPercent,
  volPercentToVariance,
} from "@/lib/btcvar30-display";
import {
  buildConvexExposureMetrics,
  deriveExternalImbalance,
  generateNonlinearConvexOrderBook,
} from "@/lib/convex-perp";
import type { CHART_CONTEXT_TABS, CHART_RANGE_BUTTONS, TIMEFRAME_OPTIONS } from "@/lib/mock-trading-data";
import type { ACTIVITY_VIEWS } from "@/lib/mock-trading-data";
import type { CONTRACT_LABELS } from "@/lib/mock-trading-data";
import type {
  BtcConvexAccountSnapshot,
  BtcConvexRiskSnapshot,
  BtcConvexPerpSnapshot,
  Candle,
  ChartDisplayMode,
  ConvexPerpOrderCancellation,
  ConvexPerpOrderSubmission,
  ConvexExposureMetrics,
  ConvexSizingMode,
  DeliveryTerm,
  ManagedConvexOrder,
  MarketStat,
  MatchingBackendOrderBookSnapshot,
  OrderBookDisplayMode,
  PreparedConvexPerpOrder,
} from "@/lib/trading.types";
import {
  CHART_TOOLS,
  CONTRACT_TABS,
  DEFAULT_BOTTOM_TAB,
  DEFAULT_CHART_CONTEXT,
  DEFAULT_CONTRACT,
  DEFAULT_FILTER,
  DEFAULT_ORDER_TYPE,
  DEFAULT_SYMBOL,
  DEFAULT_TIMEFRAME,
  FILTER_OPTIONS,
  getBaseSpotCandles,
  INSTRUMENT_MARKETS,
  MARKET_OPTIONS,
} from "@/lib/mock-trading-data";
import { BottomTabs } from "@/ui/trading-terminal/BottomTabs";
import { ChartPanel } from "@/ui/trading-terminal/ChartPanel";
import { LiveTabTitle } from "@/ui/trading-terminal/LiveTabTitle";
import { MarketHeader } from "@/ui/trading-terminal/MarketHeader";
import { OrderBook } from "@/ui/trading-terminal/OrderBook";
import { PositionShapeSparkline } from "@/ui/trading-terminal/PositionShapeSparkline";
import { TradePanel } from "@/ui/trading-terminal/TradePanel";

const DISPLAY_NUMBER_PATTERN = /-?\d+(\.\d+)?/;

function parseDisplayNumber(value: string) {
  const match = value.replaceAll(",", "").match(DISPLAY_NUMBER_PATTERN);
  return Number(match?.[0] ?? "0");
}

function shiftCandles(
  candles: (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS][keyof (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS]]["candles"],
  targetClose: number,
) {
  const currentClose = candles.at(-1)?.close ?? targetClose;
  const delta = targetClose - currentClose;

  return candles.map((candle) => ({
    ...candle,
    close: Number((candle.close + delta).toFixed(2)),
    high: Number((candle.high + delta).toFixed(2)),
    low: Number((candle.low + delta).toFixed(2)),
    open: Number((candle.open + delta).toFixed(2)),
  }));
}

function buildActivityViews(
  ticker: string,
  managedOrders: ManagedConvexOrder[],
  positionMetrics: ConvexExposureMetrics,
  onAmendOrder: (order: ManagedConvexOrder) => void,
  onCancelOrder: (order: ManagedConvexOrder) => void,
) {
  const openOrderRows =
    managedOrders.length > 0
      ? managedOrders.map((order) => ({
          cells: [
            ticker,
            order.side === "buy" ? "Long Volatility" : "Short Volatility",
            `${order.sizeBtc} BTC`,
            formatVolPercentFromVariance(order.limitPriceVariance),
            new Date(order.submittedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            <div className="flex items-center gap-2" key={`${order.orderId}-actions`}>
              <button
                className="rounded-sm border border-[#1B2430] px-2 py-1 text-[#FCA5A5] transition-colors hover:border-[#7F1D1D] hover:bg-[#3F1717]"
                onClick={() => onCancelOrder(order)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-sm border border-[#1B2430] px-2 py-1 text-[#BFDBFE] transition-colors hover:border-[#1D4ED8] hover:bg-[#13233C]"
                onClick={() => onAmendOrder(order)}
                type="button"
              >
                Amend
              </button>
            </div>,
          ],
        }))
      : [
          {
            cells: [ticker, "No active volatility orders", "-", "-", "-", "-"],
          },
        ];

  return {
    "open-orders": {
      columns: ["Instrument", "Bias", "Size", "Limit", "Submitted", "Actions"],
      rows: openOrderRows,
    },
    positions: {
      columns: ["Instrument", "Entry Vol", "Vol Exposure", "Mark Vol", "PnL"],
      rows: [
        {
          cells: [
            <div className="flex items-center gap-2" key={`${ticker}-instrument`}>
              <PositionShapeSparkline compact interactive metrics={positionMetrics} />
              <span>{ticker}</span>
            </div>,
            formatVolPercentFromVariance(positionMetrics.entryReferencePrice),
            formatExposureUsd(positionMetrics.volExposurePerPointUsd, "/ +1 pt"),
            formatVolPercentFromVariance(positionMetrics.markVariance),
            `${positionMetrics.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(positionMetrics.pnlUsd).toFixed(0)}`,
          ],
          positiveCellIndexes: [4],
        },
      ],
    },
    "trade-history": {
      columns: ["Time", "Instrument", "Bias", "Price", "Spread"],
      rows: [
        { cells: ["10:08:14", ticker, "Long Volatility", formatVolPercentFromVariance(positionMetrics.markVariance), formatDisplayedVolSpread(positionMetrics.entryReferencePrice, positionMetrics.markVariance)] },
        { cells: ["10:08:06", ticker, "Short Volatility", formatVolPercentFromVariance(positionMetrics.entryReferencePrice), formatDisplayedVolSpread(positionMetrics.entryReferencePrice * 0.998, positionMetrics.entryReferencePrice)] },
      ],
    },
  };
}

function buildTradeStatus(
  side: "buy" | "sell",
  ticker: string,
  exposureMetrics: ConvexExposureMetrics,
) {
  const action = side === "buy" ? "Long" : "Short";

  return `${action} volatility ${formatVolPercentFromVariance(exposureMetrics.markVariance)} mark, ${formatExposureUsd(exposureMetrics.volExposurePerPointUsd, "per +1 vol pt")} on ${ticker}`;
}

function getTradeSubmissionState({
  riskSnapshot,
  isBtcConvexMarket,
  orderType,
  parsedSize,
  submissionPending,
  tradeSide,
  walletConnected,
}: {
  riskSnapshot: BtcConvexRiskSnapshot | null;
  isBtcConvexMarket: boolean;
  orderType: "Limit" | "Market" | "Stop";
  parsedSize: number;
  submissionPending: boolean;
  tradeSide: "buy" | "sell";
  walletConnected: boolean;
}) {
  const exceedsAvailableCash = riskSnapshot !== null && !riskSnapshot.orderAllowed;
  const tradeSubmissionEnabled =
    isBtcConvexMarket &&
    walletConnected &&
    orderType === "Market" &&
    Number.isFinite(parsedSize) &&
    parsedSize > 0 &&
    riskSnapshot !== null &&
    !exceedsAvailableCash &&
    !submissionPending;
  let tradeSubmissionNotice = "Order entry is still using static terminal data for this market.";
  let submitLabel = walletConnected ? "Market Order Required" : "Wallet Signing Required";

  if (!isBtcConvexMarket) {
    return { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice };
  }

  if (!walletConnected) {
    tradeSubmissionNotice =
      "Connect a wallet to sign BTCVAR30 variance-native orders. Live depth continues to come from the matching backend.";

    return { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice };
  }

  if (orderType !== "Market") {
    tradeSubmissionNotice =
      "BTCVAR30 submission currently supports market orders only. Archer converts them into aggressive variance-native limit orders for the matching backend.";

    return { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice };
  }

  if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
    tradeSubmissionNotice = "Enter a non-zero BTCVAR30 size before submitting.";
    submitLabel = "Enter Valid Size";

    return { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice };
  }

  if (riskSnapshot === null) {
    tradeSubmissionNotice = "Loading risk preview from the convex risk service.";
    submitLabel = "Loading Risk";

    return { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice };
  }

  if (exceedsAvailableCash) {
    tradeSubmissionNotice = `Post-Trade Initial Margin: $${riskSnapshot.postTradeInitialMarginUsdDisplay}. Post-Trade Free Collateral: $${riskSnapshot.postTradeFreeCollateralUsdDisplay}. Model: ${riskSnapshot.marginModel}.`;
    submitLabel = "Insufficient Collateral";

    return { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice };
  }

  if (submissionPending) {
    return {
      submitLabel: "Submitting Volatility Order...",
      tradeSubmissionEnabled,
      tradeSubmissionNotice: "Waiting for your wallet signature and backend acknowledgement.",
    };
  }

  return {
    submitLabel: `${tradeSide === "buy" ? "Long" : "Short"} Volatility`,
    tradeSubmissionEnabled,
    tradeSubmissionNotice:
      "Wallet connected. Archer prepares an aggressive variance-native limit order, signs the Matching action locally, and forwards the exact backend payload.",
  };
}

async function submitSignedConvexOrder({
  deltaEquivalentBtc,
  markVariance,
  selectedWallet,
  tradeSide,
}: {
  deltaEquivalentBtc: number;
  markVariance: number;
  selectedWallet: Awaited<ReturnType<typeof useWallets>>["wallets"][number];
  tradeSide: "buy" | "sell";
}): Promise<ManagedConvexOrder> {
  const prepareResponse = await fetch("/api/markets/btcusdc-cvxperp/orders/prepare", {
    body: JSON.stringify({
      markPrice: markVariance.toFixed(4),
      ownerAddress: selectedWallet.address,
      side: tradeSide,
      sizeBtc: Math.abs(deltaEquivalentBtc).toFixed(8),
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const preparedPayload = (await prepareResponse.json()) as
    | PreparedConvexPerpOrder
    | { error?: string };

  if (!prepareResponse.ok) {
    throw new Error(
      "error" in preparedPayload
        ? (preparedPayload.error ?? "BTCVAR30 order preparation failed")
        : "BTCVAR30 order preparation failed",
    );
  }

  const preparedOrder = preparedPayload as PreparedConvexPerpOrder;
  const signature = await signConvexTypedData({
    preparedOrder,
    selectedWallet,
  });
  const unsignedOrder = {
    ...preparedOrder.order,
    signature,
  };
  const response = await fetch("/api/markets/btcusdc-cvxperp/orders", {
    body: JSON.stringify(unsignedOrder),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as ConvexPerpOrderSubmission | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload
        ? (payload.error ?? "BTCVAR30 order submission failed")
        : "BTCVAR30 order submission failed",
    );
  }

  return {
    limitPriceVariance: Number(preparedOrder.limitPriceDisplay),
    nonce: unsignedOrder.nonce,
    orderId: unsignedOrder.order_id,
    ownerAddress: unsignedOrder.owner_address,
    side: tradeSide,
    sizeBtc: Math.abs(deltaEquivalentBtc).toFixed(8),
    submittedAt: new Date().toISOString(),
  };
}

function useBtcConvexMarketData({
  initialBtcOrderBook,
  initialBtcSnapshot,
  selectedSymbol,
}: {
  initialBtcOrderBook: MatchingBackendOrderBookSnapshot | null;
  initialBtcSnapshot: BtcConvexPerpSnapshot | null;
  selectedSymbol: keyof typeof INSTRUMENT_MARKETS;
}) {
  const [btcOrderBook, setBtcOrderBook] = useState<MatchingBackendOrderBookSnapshot | null>(
    initialBtcOrderBook,
  );
  const [btcSnapshot, setBtcSnapshot] = useState<BtcConvexPerpSnapshot | null>(initialBtcSnapshot);

  const refreshBtcConvexMarket = useEffectEvent(async function refreshBtcConvexMarket() {
    try {
      const response = await fetch("/api/markets/btcusdc-cvxperp", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      setBtcSnapshot((await response.json()) as BtcConvexPerpSnapshot);
    } catch {
      // Keep the last good snapshot and let the rest of the UI continue rendering.
    }
  });

  const refreshBtcConvexOrderBook = useEffectEvent(async function refreshBtcConvexOrderBook() {
    try {
      const response = await fetch("/api/markets/btcusdc-cvxperp/book", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      setBtcOrderBook((await response.json()) as MatchingBackendOrderBookSnapshot);
    } catch {
      // Keep the last good snapshot and let the rest of the UI continue rendering.
    }
  });

  useEffect(() => {
    if (selectedSymbol !== "BTC/USD") {
      return;
    }

    void refreshBtcConvexMarket();
    void refreshBtcConvexOrderBook();

    const intervalId = window.setInterval(() => {
      void refreshBtcConvexMarket();
      void refreshBtcConvexOrderBook();
    }, BTC_MARKET_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedSymbol]);

  return { btcOrderBook, btcSnapshot };
}

function getPricePrecision(chartContext: ChartDisplayMode) {
  if (chartContext === "Vol") {
    return 2;
  }

  if (chartContext === "Variance") {
    return 4;
  }

  return 0;
}

function getBaseAsset(symbol: string) {
  if (symbol.includes("-")) {
    return symbol.split("USD")[0] ?? symbol;
  }

  return symbol.split("/")[0] ?? symbol;
}

function getInstrumentKeyFromMarketId(marketId: string): keyof typeof INSTRUMENT_MARKETS {
  void marketId;
  return "BTC/USD";
}

function getChartUpdateInterval(timeframe: (typeof TIMEFRAME_OPTIONS)[number]) {
  if (timeframe === "5m") {
    return 1100;
  }

  if (timeframe === "D") {
    return 2400;
  }

  return 1700;
}

function getDisplayCandles(
  chartContext: ChartDisplayMode,
  liveMarkVariance: number,
  marketCandles: Candle[],
  _liveIndexVariance: number,
) {
  if (chartContext === "Variance") {
    return marketCandles.map((candle) => ({
      ...candle,
      close: volPercentToVariance(candle.close),
      high: volPercentToVariance(candle.high),
      low: volPercentToVariance(candle.low),
      open: volPercentToVariance(candle.open),
    }));
  }

  if (chartContext === "BTC Spot") {
    return getBaseSpotCandles().map(([open, high, low, close, volume], index) => ({
      close,
      high,
      low,
      open,
      time: marketCandles[index]?.time ?? `${String((index + 8) % 24).padStart(2, "0")}:00`,
      volume,
    }));
  }

  return shiftCandles(marketCandles, varianceToVolPercent(liveMarkVariance));
}

function getNextCandleTimeLabel(currentLabel: string) {
  if (currentLabel.includes(":")) {
    const [hoursString] = currentLabel.split(":");
    const hours = Number(hoursString);
    return `${String((hours + 1) % 24).padStart(2, "0")}:00`;
  }

  const [monthString, dayString] = currentLabel.split("-");

  if (!monthString || !dayString) {
    return currentLabel;
  }

  const nextDay = Number(dayString) + 1;
  return `${monthString}-${String(nextDay).padStart(2, "0")}`;
}

function simulateLiveCandles(
  candles: Candle[],
  chartContext: ChartDisplayMode,
  timeframe: (typeof TIMEFRAME_OPTIONS)[number],
) {
  const lastCandle = candles.at(-1);

  if (!lastCandle) {
    return candles;
  }

  const precision = getPricePrecision(chartContext);
  let timeframeScale = 1;

  if (timeframe === "5m") {
    timeframeScale = 0.7;
  } else if (timeframe === "D") {
    timeframeScale = 1.8;
  }

  const drift = chartContext === "BTC Spot" ? 42 * timeframeScale : 0.12 * timeframeScale;
  let volatility = 0.55 * timeframeScale;

  if (chartContext === "BTC Spot") {
    volatility = 88 * timeframeScale;
  } else if (chartContext === "Variance") {
    volatility = 0.004 * timeframeScale;
  }
  const directionalBias = Math.random() > 0.5 ? drift : -drift;
  const delta = directionalBias + (Math.random() - 0.5) * volatility;
  const nextClose = Number((lastCandle.close + delta).toFixed(precision));
  const nextHigh = Number((Math.max(lastCandle.high, nextClose) + Math.random() * volatility * 0.3).toFixed(precision));
  const nextLow = Number((Math.min(lastCandle.low, nextClose) - Math.random() * volatility * 0.3).toFixed(precision));
  const nextVolume = Math.max(1, Math.round(lastCandle.volume + (Math.random() - 0.5) * lastCandle.volume * 0.18));

  const updatedCurrent = {
    ...lastCandle,
    close: nextClose,
    high: nextHigh,
    low: nextLow,
    volume: nextVolume,
  } satisfies Candle;

  let rollChance = 0.28;

  if (timeframe === "5m") {
    rollChance = 0.36;
  } else if (timeframe === "D") {
    rollChance = 0.18;
  }

  if (Math.random() < rollChance) {
    const nextOpen = nextClose;
    const seededClose = Number((nextOpen + (Math.random() - 0.5) * volatility).toFixed(precision));
    const nextCandle = {
      close: seededClose,
      high: Number((Math.max(nextOpen, seededClose) + Math.random() * volatility * 0.35).toFixed(precision)),
      low: Number((Math.min(nextOpen, seededClose) - Math.random() * volatility * 0.35).toFixed(precision)),
      open: nextOpen,
      time: getNextCandleTimeLabel(lastCandle.time),
      volume: Math.max(1, Math.round(lastCandle.volume * (0.88 + Math.random() * 0.24))),
    } satisfies Candle;

    return [...candles.slice(1, -1), updatedCurrent, nextCandle];
  }

  return [...candles.slice(0, -1), updatedCurrent];
}

function buildLiveInfoBar(
  infoBar: MarketStat[],
  liveIndexVariance: number,
  liveMarkVariance: number,
) {
  const display = getBtcVar30DisplayFields({
    indexValue: liveIndexVariance,
    indexValueSource: "variance",
    markValue: liveMarkVariance,
    markValueSource: "variance",
  });

  return infoBar.map((item: MarketStat) => {
    if (item.label === "Mark Vol") {
      return { ...item, value: display.displayMarkVol };
    }

    if (item.label === "Variance Mark") {
      return { ...item, value: formatVariancePrice(liveMarkVariance) };
    }

    if (item.label === "24h Change") {
      return { ...item, value: `${display.changePercent >= 0 ? "+" : ""}${display.changePercent.toFixed(2)}%` };
    }

    if (item.label === "Funding (variance)") {
      return { ...item, value: formatFundingVarianceBps(1).replace("Funding (variance): ", "") };
    }

    return item;
  });
}

function getDeliveryValue(positionOverview: DeliveryTerm[], label: string) {
  return positionOverview.find((item) => item.label === label)?.value ?? "";
}

function buildPositionOverview(positionMetrics: ConvexExposureMetrics) {
  const spotSensitivityBtc = getDisplaySpotSensitivityBtc(positionMetrics.deltaEquivalentBtc);

  return [
    { label: "Entry Vol", value: formatVolPercentFromVariance(positionMetrics.entryReferencePrice) },
    { label: "Variance Entry", value: formatVariancePrice(positionMetrics.entryReferencePrice) },
    { label: "Vol Exposure", value: formatExposureUsd(positionMetrics.volExposurePerPointUsd, "per +1 vol pt") },
    { label: "Variance Exposure", value: formatExposureUsd(positionMetrics.varianceExposurePerPoint01Usd, "per +0.01 variance") },
    ...(spotSensitivityBtc === null
      ? []
      : [{ label: "Spot Sensitivity (BTC)", value: `${spotSensitivityBtc.toFixed(2)} BTC` }]),
    { label: "Funding (variance)", value: `${formatFundingVarianceBps(1).replace("Funding (variance): ", "")} / 8h` },
    { label: "Break-even Move", value: `±${positionMetrics.breakEvenMovePercent.toFixed(2)}%` },
    { label: "Mark Vol", value: formatVolPercentFromVariance(positionMetrics.markVariance) },
    { label: "Unrealized PnL", value: `${positionMetrics.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(positionMetrics.pnlUsd).toFixed(0)}` },
  ] satisfies DeliveryTerm[];
}

function resolveLiveMarketPrices({
  btcSnapshot,
  market,
  selectedSymbol,
}: {
  btcSnapshot: BtcConvexPerpSnapshot | null;
  market: (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS][keyof (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS]];
  selectedSymbol: keyof typeof INSTRUMENT_MARKETS;
}) {
  let liveIndex = volPercentToVariance(parseDisplayNumber(market.index));
  let liveMark = volPercentToVariance(parseDisplayNumber(market.mark));

  if (selectedSymbol === "BTC/USD" && btcSnapshot !== null) {
    liveIndex = btcSnapshot.indexVariance;
    liveMark = btcSnapshot.markVariance;
  }

  return { liveIndex, liveMark };
}

function buildDynamicMarketOptions({
  btcSnapshot,
}: {
  btcSnapshot: BtcConvexPerpSnapshot | null;
}) {
  return MARKET_OPTIONS.map((marketOption) => {
    if (marketOption.id === "btc-var-30-perp" && btcSnapshot !== null) {
      return {
        ...marketOption,
        displayName: btcSnapshot.display_name,
        lastPrice: formatVolPercentFromVariance(btcSnapshot.markVariance),
        semantics: getBtcVar30Semantics(),
      };
    }

    return marketOption;
  });
}

function buildTerminalViewModel({
  btcOrderBook,
  btcSnapshot,
  market,
  selectedMarketId,
  selectedSymbol,
  size,
  sizingMode,
  tradeSide,
}: {
  btcOrderBook: MatchingBackendOrderBookSnapshot | null;
  btcSnapshot: BtcConvexPerpSnapshot | null;
  market: (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS][keyof (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS]];
  selectedMarketId: string;
  selectedSymbol: keyof typeof INSTRUMENT_MARKETS;
  size: string;
  sizingMode: ConvexSizingMode;
  tradeSide: "buy" | "sell";
}) {
  const isBtcConvexMarket = selectedMarketId === "btc-var-30-perp";
  const liveBtcOrderBook = isBtcConvexMarket && btcOrderBook !== null;
  const { liveIndex, liveMark } = resolveLiveMarketPrices({
    btcSnapshot,
    market,
    selectedSymbol,
  });
  const dynamicMarketOptions = buildDynamicMarketOptions({
    btcSnapshot,
  });
  const selectedMarket =
    dynamicMarketOptions.find((marketOption) => marketOption.id === selectedMarketId) ??
    dynamicMarketOptions[0];
  const positionEntryReference = parseDisplayNumber(
    getDeliveryValue(market.positionOverview, "Variance Entry"),
  );
  const positionConvexNotional = parseDisplayNumber(
    getDeliveryValue(market.positionOverview, "Variance Notional"),
  );
  const currentPositionMetrics = buildConvexExposureMetrics({
    entryReferencePrice: positionEntryReference || liveIndex,
    inputValue: positionConvexNotional || 0,
    markPrice: liveMark,
    referencePrice: liveIndex || liveMark,
    side: "buy",
    sizingMode: "notional",
  });
  const orderPreviewMetrics = buildConvexExposureMetrics({
    entryReferencePrice: liveIndex || liveMark,
    inputValue: Number(size || "0"),
    markPrice: liveMark,
    referencePrice: liveIndex || liveMark,
    side: tradeSide,
    sizingMode,
  });
  const displayOrderBook =
    market.presentation?.variant === "convex"
      ? generateNonlinearConvexOrderBook({
          baseTopLevelSize: market.orderBookAsks[0]?.size ?? 0.85,
          convexityRisk: market.presentation.riskModel?.convexityRisk ?? 0.4,
          externalImbalance: deriveExternalImbalance(
            liveBtcOrderBook ? { asks: btcOrderBook.asks, bids: btcOrderBook.bids } : null,
          ),
          fundingRateBps: market.presentation.riskModel?.fundingRateBps ?? 1,
          inventorySkew: market.presentation.riskModel?.inventorySkew ?? 0,
          levels: Math.max(market.orderBookAsks.length, market.orderBookBids.length, 7),
          midPrice: liveMark,
          realizedVol: market.presentation.riskModel?.realizedVol ?? 0.02,
          referencePrice: liveIndex || liveMark,
        })
      : {
          asks: market.orderBookAsks,
          bids: market.orderBookBids,
          riskModel: market.presentation?.riskModel,
        };

  return {
    currentPositionMetrics,
    displayOrderBook,
    dynamicMarketOptions,
    dynamicPositionOverview: buildPositionOverview(currentPositionMetrics),
    isBtcConvexMarket,
    liveIndex,
    liveMark,
    orderPreviewMetrics,
    selectedMarket,
  };
}

type SelectedContract = (typeof CONTRACT_LABELS)[number];
const BTC_MARKET_POLL_INTERVAL_MS = 5000;
const BASE_CHAIN_HEX = "0x2105";

function getChainMismatchMessage(chainId: number) {
  return `Switch your wallet to Base (${chainId}) before signing the BTCVAR30 order.`;
}

function buildConvexTypedDataForSigning(preparedOrder: PreparedConvexPerpOrder) {
  return {
    ...preparedOrder.typedData,
    domain: {
      ...preparedOrder.typedData.domain,
      chainId: BigInt(preparedOrder.typedData.domain.chainId),
    },
    message: {
      ...preparedOrder.typedData.message,
      expiry: BigInt(preparedOrder.typedData.message.expiry),
      nonce: BigInt(preparedOrder.typedData.message.nonce),
      subaccountId: BigInt(preparedOrder.typedData.message.subaccountId),
    },
  };
}

function buildConvexTypedDataForProvider(preparedOrder: PreparedConvexPerpOrder) {
  return {
    ...preparedOrder.typedData,
    domain: {
      ...preparedOrder.typedData.domain,
      chainId: preparedOrder.typedData.domain.chainId,
    },
    message: {
      ...preparedOrder.typedData.message,
      expiry: preparedOrder.typedData.message.expiry,
      nonce: preparedOrder.typedData.message.nonce,
      subaccountId: preparedOrder.typedData.message.subaccountId,
    },
  };
}

function isEmbeddedWallet(wallet: Awaited<ReturnType<typeof useWallets>>["wallets"][number]) {
  const connectorType = (wallet as { connectorType?: string }).connectorType;

  return connectorType === "embedded" || connectorType === "embedded_imported";
}

function getWalletConnectorType(wallet: Awaited<ReturnType<typeof useWallets>>["wallets"][number]) {
  return (wallet as { connectorType?: string }).connectorType ?? null;
}

async function ensureWalletChain(provider: { request(args: { method: string; params?: unknown[] }): Promise<unknown> }, chainId: number) {
  const currentChainId = (await provider.request({
    method: "eth_chainId",
  })) as string;

  if (Number.parseInt(currentChainId, 16) === chainId) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("4902")) {
      throw new Error(getChainMismatchMessage(chainId));
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          blockExplorerUrls: ["https://basescan.org"],
          chainId: BASE_CHAIN_HEX,
          chainName: "Base",
          nativeCurrency: {
            decimals: 18,
            name: "Ether",
            symbol: "ETH",
          },
          rpcUrls: ["https://mainnet.base.org"],
        },
      ],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
  }
}

async function signConvexTypedData({
  preparedOrder,
  selectedWallet,
}: {
  preparedOrder: PreparedConvexPerpOrder;
  selectedWallet: Awaited<ReturnType<typeof useWallets>>["wallets"][number];
}) {
  if (isEmbeddedWallet(selectedWallet)) {
    const account = await toViemAccount({ wallet: selectedWallet });
    const signaturePayload = buildConvexTypedDataForSigning(preparedOrder);

    return account.signTypedData(signaturePayload as Parameters<typeof account.signTypedData>[0]);
  }

  const provider = await selectedWallet.getEthereumProvider();
  const providerPayload = buildConvexTypedDataForProvider(preparedOrder);
  const connectorType = getWalletConnectorType(selectedWallet);
  await ensureWalletChain(provider, preparedOrder.typedData.domain.chainId);

  if (connectorType === "wallet_connect_v2") {
    return (await provider.request({
      method: "eth_signTypedData",
      params: [selectedWallet.address, providerPayload],
    })) as string;
  }

  try {
    return (await provider.request({
      method: "eth_signTypedData_v4",
      params: [selectedWallet.address, providerPayload],
    })) as string;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.toLowerCase().includes("parse")) {
      throw error;
    }

    return (await provider.request({
      method: "eth_signTypedData_v4",
      params: [selectedWallet.address, JSON.stringify(providerPayload)],
    })) as string;
  }
}

async function cancelManagedConvexOrder(order: ManagedConvexOrder) {
  const response = await fetch("/api/markets/btcusdc-cvxperp/orders/cancel", {
    body: JSON.stringify({
      nonce: order.nonce,
      ownerAddress: order.ownerAddress,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json()) as ConvexPerpOrderCancellation | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload
        ? (payload.error ?? "BTCVAR30 cancel failed")
        : "BTCVAR30 cancel failed",
    );
  }
}

async function getManagedConvexOrders(ownerAddress: string) {
  const searchParams = new URLSearchParams({
    ownerAddress,
  });
  const response = await fetch(`/api/markets/btcusdc-cvxperp/orders/open?${searchParams.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as ManagedConvexOrder[] | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload
        ? (payload.error ?? "BTCVAR30 open-orders load failed")
        : "BTCVAR30 open-orders load failed",
    );
  }

  return payload as ManagedConvexOrder[];
}

async function getBtcConvexAccount(ownerAddress: string) {
  const searchParams = new URLSearchParams({
    ownerAddress,
  });
  const response = await fetch(`/api/markets/btcusdc-cvxperp/account?${searchParams.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as BtcConvexAccountSnapshot | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload
        ? (payload.error ?? "BTCVAR30 account load failed")
        : "BTCVAR30 account load failed",
    );
  }

  return payload as BtcConvexAccountSnapshot;
}

async function getBtcConvexRiskPreview({
  ownerAddress,
  side,
  sizeBtc,
}: {
  ownerAddress: string;
  side: "buy" | "sell";
  sizeBtc: string;
}) {
  const searchParams = new URLSearchParams({
    ownerAddress,
    side,
    sizeBtc,
  });
  const response = await fetch(`/api/markets/btcusdc-cvxperp/risk?${searchParams.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as BtcConvexRiskSnapshot | { error?: string };

  if (!response.ok) {
    throw new Error(
      "error" in payload
        ? (payload.error ?? "BTCVAR30 risk preview failed")
        : "BTCVAR30 risk preview failed",
    );
  }

  return payload as BtcConvexRiskSnapshot;
}

export function TradingTerminal({
  initialBtcOrderBook,
  initialBtcSnapshot,
}: {
  initialBtcOrderBook: MatchingBackendOrderBookSnapshot | null;
  initialBtcSnapshot: BtcConvexPerpSnapshot | null;
}) {
  const { authenticated, ready: privyReady } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const [selectedMarketId, setSelectedMarketId] = useState("btc-var-30-perp");
  const [selectedSymbol, setSelectedSymbol] =
    useState<keyof typeof INSTRUMENT_MARKETS>(DEFAULT_SYMBOL);
  const [selectedContract, setSelectedContract] = useState<SelectedContract>(DEFAULT_CONTRACT);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAME_OPTIONS)[number]>(DEFAULT_TIMEFRAME);
  const [chartContext, setChartContext] = useState<(typeof CHART_CONTEXT_TABS)[number]>(
    DEFAULT_CHART_CONTEXT,
  );
  const [selectedRange, setSelectedRange] =
    useState<(typeof CHART_RANGE_BUTTONS)[number]>("1d");
  const [selectedTool, setSelectedTool] = useState(CHART_TOOLS[0]?.id ?? "crosshair");
  const [indicatorsEnabled, setIndicatorsEnabled] = useState(false);
  const [expandedChart, setExpandedChart] = useState(false);
  const [orderBookView, setOrderBookView] = useState<"Order Book" | "Trades">("Order Book");
  const [orderBookDisplayMode, setOrderBookDisplayMode] = useState<OrderBookDisplayMode>("price");
  const [orderType, setOrderType] = useState<"Limit" | "Market" | "Stop">(DEFAULT_ORDER_TYPE);
  const [sizingMode, setSizingMode] = useState<ConvexSizingMode>("notional");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("64000");
  const [allocation, setAllocation] = useState(20);
  const [postOnly, setPostOnly] = useState(false);
  const [selectedBottomTab, setSelectedBottomTab] =
    useState<keyof typeof ACTIVITY_VIEWS>(DEFAULT_BOTTOM_TAB);
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>(DEFAULT_FILTER);
  const { btcOrderBook, btcSnapshot } = useBtcConvexMarketData({
    initialBtcOrderBook,
    initialBtcSnapshot,
    selectedSymbol,
  });
  const [btcAccountSnapshot, setBtcAccountSnapshot] = useState<BtcConvexAccountSnapshot | null>(null);
  const [btcRiskSnapshot, setBtcRiskSnapshot] = useState<BtcConvexRiskSnapshot | null>(null);
  const [managedOrders, setManagedOrders] = useState<ManagedConvexOrder[]>([]);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [submissionPending, setSubmissionPending] = useState(false);

  const market = INSTRUMENT_MARKETS[selectedSymbol][selectedContract];
  const {
    currentPositionMetrics,
    displayOrderBook,
    dynamicMarketOptions,
    dynamicPositionOverview,
    isBtcConvexMarket,
    liveIndex,
    liveMark,
    orderPreviewMetrics,
    selectedMarket,
  } = buildTerminalViewModel({
    btcOrderBook,
    btcSnapshot,
    market,
    selectedMarketId,
    selectedSymbol,
    size,
    sizingMode,
    tradeSide,
  });
  const displayTicker = selectedMarket.symbol;
  const lastAction =
    submissionFeedback ?? buildTradeStatus(tradeSide, displayTicker, orderPreviewMetrics);
  const displayCandles = getDisplayCandles(
    chartContext,
    liveMark,
    market.candles,
    liveIndex,
  );

  const liveInfoBar = buildLiveInfoBar(
    market.infoBar,
    liveIndex,
    liveMark,
  );
  const [liveCandles, setLiveCandles] = useState<Candle[]>(displayCandles);
  const displayOrderBookAsks = displayOrderBook.asks;
  const displayOrderBookBids = displayOrderBook.bids;
  const walletConnected = privyReady && walletsReady && authenticated && wallets.length > 0;
  const selectedWallet = wallets[0] ?? null;
  const parsedSize = Number(size || "0");
  const { submitLabel, tradeSubmissionEnabled, tradeSubmissionNotice } =
    getTradeSubmissionState({
      riskSnapshot: btcRiskSnapshot,
      isBtcConvexMarket,
      orderType,
      parsedSize,
      submissionPending,
      tradeSide,
      walletConnected,
    });

  const cancelBtcConvexOrder = useEffectEvent(async function cancelBtcConvexOrder(
    order: ManagedConvexOrder,
  ) {
    setSubmissionPending(true);
    setSubmissionFeedback(`Cancelling ${order.orderId.slice(0, 14)}...`);

    try {
      await cancelManagedConvexOrder(order);
      setManagedOrders((current) => current.filter((candidate) => candidate.orderId !== order.orderId));
      setSubmissionFeedback(`Cancelled volatility order ${order.orderId.slice(0, 14)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BTCVAR30 cancel failed";
      setSubmissionFeedback(message);
    } finally {
      setSubmissionPending(false);
    }
  });

  const amendBtcConvexOrder = useEffectEvent(async function amendBtcConvexOrder(
    order: ManagedConvexOrder,
  ) {
    if (!selectedWallet) {
      return;
    }

    setSubmissionPending(true);
    setSubmissionFeedback(`Replacing ${order.orderId.slice(0, 14)} with current order settings...`);

    try {
      await cancelManagedConvexOrder(order);
      const replacementOrder = await submitSignedConvexOrder({
        deltaEquivalentBtc: orderPreviewMetrics.deltaEquivalentBtc,
        markVariance: liveMark,
        selectedWallet,
        tradeSide,
      });
      setManagedOrders((current) => [replacementOrder, ...current.filter((candidate) => candidate.orderId !== order.orderId)]);
      setSubmissionFeedback(
        `Replaced ${order.orderId.slice(0, 14)} with ${replacementOrder.orderId.slice(0, 14)}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "BTCVAR30 amend failed";
      setSubmissionFeedback(message);
    } finally {
      setSubmissionPending(false);
    }
  });

  const dynamicActivityViews = buildActivityViews(
    displayTicker,
    managedOrders,
    currentPositionMetrics,
    (order) => void amendBtcConvexOrder(order),
    (order) => void cancelBtcConvexOrder(order),
  );

  const submitBtcConvexOrder = useEffectEvent(async function submitBtcConvexOrder() {
    if (!tradeSubmissionEnabled || !selectedWallet) {
      return;
    }

    setSubmissionPending(true);
    setSubmissionFeedback("Awaiting wallet signature...");

    try {
      const submittedOrder = await submitSignedConvexOrder({
        deltaEquivalentBtc: orderPreviewMetrics.deltaEquivalentBtc,
        markVariance: liveMark,
        selectedWallet,
        tradeSide,
      });
      setManagedOrders((current) => [submittedOrder, ...current]);

      setSubmissionFeedback(
        `Submitted ${tradeSide === "buy" ? "long" : "short"} volatility order ${submittedOrder.orderId.slice(0, 14)} to the matching backend.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "BTCVAR30 order submission failed";
      setSubmissionFeedback(message);
    } finally {
      setSubmissionPending(false);
    }
  });

  const refreshManagedOrders = useEffectEvent(async function refreshManagedOrders() {
    if (!selectedWallet || !isBtcConvexMarket) {
      setManagedOrders([]);
      return;
    }

    try {
      setManagedOrders(await getManagedConvexOrders(selectedWallet.address));
    } catch {
      // Keep the current order list if backend reads fail temporarily.
    }
  });

  const refreshBtcAccount = useEffectEvent(async function refreshBtcAccount() {
    if (!selectedWallet || !isBtcConvexMarket) {
      setBtcAccountSnapshot(null);
      return;
    }

    try {
      setBtcAccountSnapshot(await getBtcConvexAccount(selectedWallet.address));
    } catch {
      // Keep the current account snapshot if the backend read fails temporarily.
    }
  });

  const refreshBtcRisk = useEffectEvent(async function refreshBtcRisk() {
    if (!selectedWallet || !isBtcConvexMarket || !Number.isFinite(parsedSize) || parsedSize <= 0) {
      setBtcRiskSnapshot(null);
      return;
    }

    try {
      setBtcRiskSnapshot(
        await getBtcConvexRiskPreview({
          ownerAddress: selectedWallet.address,
          side: tradeSide,
          sizeBtc: Math.abs(orderPreviewMetrics.deltaEquivalentBtc).toFixed(8),
        }),
      );
    } catch {
      setBtcRiskSnapshot(null);
    }
  });

  useEffect(() => {
    setLiveCandles(
      getDisplayCandles(
        chartContext,
        liveMark,
        market.candles,
        liveIndex,
      ),
    );
  }, [
    chartContext,
    liveMark,
    liveIndex,
    market.candles,
    selectedContract,
    selectedMarketId,
    selectedSymbol,
    timeframe,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveCandles((currentCandles) => simulateLiveCandles(currentCandles, chartContext, timeframe));
    }, getChartUpdateInterval(timeframe));

    return () => window.clearInterval(intervalId);
  }, [selectedMarketId, timeframe, chartContext]);

  useEffect(() => {
    setOrderBookDisplayMode(market.presentation?.displayMode ?? "price");
    setSizingMode(market.presentation?.sizingModes?.[0] ?? "notional");
    setSize(market.presentation?.variant === "convex" ? "64000" : "1");
  }, [market.presentation, selectedContract, selectedMarketId, selectedSymbol]);

  useEffect(() => {
    void refreshManagedOrders();
  }, [selectedWallet?.address, isBtcConvexMarket]);

  useEffect(() => {
    void refreshBtcAccount();
  }, [selectedWallet?.address, isBtcConvexMarket]);

  useEffect(() => {
    void refreshBtcRisk();
  }, [selectedWallet?.address, isBtcConvexMarket, parsedSize, liveMark, liveIndex, sizingMode, tradeSide]);

  function handleContractSelect(contract: string) {
    startTransition(() => {
      setSelectedContract(contract as SelectedContract);
    });
  }

  function handleMarketSelect(marketId: string) {
    const nextMarket = MARKET_OPTIONS.find((marketOption) => marketOption.id === marketId);

    if (!nextMarket) {
      return;
    }

    startTransition(() => {
      setSelectedMarketId(marketId);
      setSelectedSymbol(getInstrumentKeyFromMarketId(nextMarket.id));
      setSelectedContract(DEFAULT_CONTRACT);
    });
  }

  function handleFilterCycle() {
    const currentIndex = FILTER_OPTIONS.indexOf(filter);
    const next = FILTER_OPTIONS[(currentIndex + 1) % FILTER_OPTIONS.length];
    setFilter(next);
  }

  return (
    <main className="min-h-screen bg-[#0B1118] text-[#D1D5DB] xl:h-screen xl:overflow-hidden">
      <LiveTabTitle pair={displayTicker} price={liveMark} />

      <div className="mx-auto flex min-h-screen w-full max-w-none flex-col p-2 xl:h-screen xl:overflow-hidden">
        <MarketHeader
          contractTabs={CONTRACT_TABS}
          currentContract={selectedContract}
          currentDisplayName={selectedMarket.displayName ?? market.presentation?.semantics?.displayName ?? displayTicker}
          currentMarketId={selectedMarketId}
          currentSemantics={selectedMarket.semantics ?? market.presentation?.semantics}
          currentSymbol={displayTicker}
          infoBar={liveInfoBar}
          marketOptions={dynamicMarketOptions}
          onContractSelect={handleContractSelect}
          onMarketSelect={handleMarketSelect}
        />

        <section className="mt-2 grid flex-1 grid-cols-1 gap-2 xl:min-h-0 xl:grid-cols-[minmax(0,65fr)_minmax(280px,20fr)_minmax(250px,15fr)] xl:overflow-hidden">
          <div className="min-h-[540px] xl:min-h-0 xl:overflow-hidden">
            <ChartPanel
              candles={liveCandles}
              chartContext={chartContext}
              exposureMetrics={currentPositionMetrics}
              expandedChart={expandedChart}
              indicatorsEnabled={indicatorsEnabled}
              riskModel={displayOrderBook.riskModel}
              semantics={market.presentation?.semantics}
              selectedRange={selectedRange}
              selectedTimeframe={timeframe}
              selectedTool={selectedTool}
              ticker={displayTicker}
              onChartContextChange={setChartContext}
              onExpandedToggle={() => setExpandedChart((current) => !current)}
              onIndicatorsToggle={() => setIndicatorsEnabled((current) => !current)}
              onRangeChange={setSelectedRange}
              onTimeframeChange={setTimeframe}
              onToolSelect={setSelectedTool}
            />
          </div>

          <div className="min-h-[420px] xl:min-h-0 xl:overflow-hidden">
            <OrderBook
              asks={displayOrderBookAsks}
              bids={displayOrderBookBids}
              contractLabel={selectedContract}
              displayMode={orderBookDisplayMode}
              nonlinearLadderLabel={
                market.presentation && "nonlinearLadderLabel" in market.presentation
                  ? market.presentation.nonlinearLadderLabel
                  : undefined
              }
              riskModel={displayOrderBook.riskModel}
              semantics={market.presentation?.semantics}
              trades={market.trades}
              view={orderBookView}
              onDisplayModeChange={setOrderBookDisplayMode}
              onViewChange={setOrderBookView}
            />
          </div>

          <div className="min-h-[420px] xl:min-h-0 xl:overflow-hidden">
            <TradePanel
              accountSnapshot={btcAccountSnapshot}
              baseAsset={getBaseAsset(selectedSymbol)}
              allocation={allocation}
              contractDetails={market.contractDetails}
              contractLabel={displayTicker}
              executionMode={tradeSubmissionEnabled ? "ready" : "disabled"}
              exposureMetrics={orderPreviewMetrics}
              lastAction={lastAction}
              onSubmit={() => void submitBtcConvexOrder()}
              orderType={orderType}
              positionOverview={dynamicPositionOverview}
              postOnly={postOnly}
              quoteAsset="USDC"
              riskSnapshot={btcRiskSnapshot}
              settlementWallet="USDC Margin"
              size={size}
              sizingMode={sizingMode}
              submissionEnabled={tradeSubmissionEnabled}
              submissionPending={submissionPending}
              submissionNotice={tradeSubmissionNotice}
              submitLabel={submitLabel}
              supportedSizingModes={market.presentation?.sizingModes ?? ["notional"]}
              tradeSide={tradeSide}
              onAllocationChange={setAllocation}
              onOrderTypeChange={setOrderType}
              onPostOnlyToggle={() => setPostOnly((current) => !current)}
              onSideChange={setTradeSide}
              onSizeChange={setSize}
              onSizingModeChange={setSizingMode}
            />
          </div>
        </section>

        <div className="mt-2 xl:shrink-0">
          <BottomTabs
            activityView={dynamicActivityViews[selectedBottomTab]}
            filter={filter}
            footerLinks={[]}
            selectedTab={selectedBottomTab}
            tabs={[
              { id: "positions", label: "Positions" },
              { id: "open-orders", label: "Open Orders" },
              { id: "trade-history", label: "Trade History" },
            ]}
            onFilterClick={handleFilterCycle}
            onTabSelect={(tabId) => setSelectedBottomTab(tabId as keyof typeof ACTIVITY_VIEWS)}
          />
        </div>
      </div>
    </main>
  );
}
