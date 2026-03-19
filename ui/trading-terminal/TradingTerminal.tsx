"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import {
  buildConvexExposureMetrics,
  deriveExternalImbalance,
  generateNonlinearConvexOrderBook,
} from "@/lib/convex-perp";
import type { CHART_CONTEXT_TABS, CHART_RANGE_BUTTONS, TIMEFRAME_OPTIONS } from "@/lib/mock-trading-data";
import type { ACTIVITY_VIEWS } from "@/lib/mock-trading-data";
import type { CONTRACT_LABELS } from "@/lib/mock-trading-data";
import type {
  BtcSquaredPerpSnapshot,
  Candle,
  ConvexExposureMetrics,
  ConvexSizingMode,
  DeliveryTerm,
  MarketStat,
  MatchingBackendOrderBookSnapshot,
  NgnPerpSnapshot,
  OrderBookDisplayMode,
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
  INSTRUMENT_MARKETS,
  MARKET_OPTIONS,
} from "@/lib/mock-trading-data";
import { BottomTabs } from "@/ui/trading-terminal/BottomTabs";
import { ChartPanel } from "@/ui/trading-terminal/ChartPanel";
import { LiveTabTitle } from "@/ui/trading-terminal/LiveTabTitle";
import { MarketHeader } from "@/ui/trading-terminal/MarketHeader";
import { OrderBook } from "@/ui/trading-terminal/OrderBook";
import { TradePanel } from "@/ui/trading-terminal/TradePanel";

const DISPLAY_NUMBER_PATTERN = /-?\d+(\.\d+)?/;

function formatPrice(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function parseNumericString(value: string) {
  return Number(value.replaceAll(",", "").replaceAll("$", "").replaceAll("+", ""));
}

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
  orderPreviewMetrics: ConvexExposureMetrics,
  positionMetrics: ConvexExposureMetrics,
) {
  return {
    "open-orders": {
      columns: ["Instrument", "Bias", "Mode", "Convex Notional", "Entry Ref"],
      rows: [
        {
          cells: [
            ticker,
            "Long Convexity",
            "Notional",
            `$${Math.round(orderPreviewMetrics.convexNotionalUsd).toLocaleString("en-US")}`,
            orderPreviewMetrics.entryReferencePrice.toFixed(2),
          ],
        },
      ],
    },
    positions: {
      columns: ["Instrument", "Entry Ref", "Convex Notional", "Delta Eq", "Mark", "PnL"],
      rows: [
        {
          cells: [
            ticker,
            positionMetrics.entryReferencePrice.toFixed(2),
            `$${Math.round(positionMetrics.convexNotionalUsd).toLocaleString("en-US")}`,
            `${positionMetrics.deltaEquivalentBtc.toFixed(2)} BTC`,
            positionMetrics.markPrice.toFixed(2),
            `${positionMetrics.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(positionMetrics.pnlUsd).toFixed(0)}`,
          ],
          positiveCellIndexes: [5],
        },
      ],
    },
    "trade-history": {
      columns: ["Time", "Instrument", "Bias", "Delta Eq", "Price"],
      rows: [
        { cells: ["10:08:14", ticker, "Long Convexity", "1.52 BTC", positionMetrics.markPrice.toFixed(2)] },
        { cells: ["10:08:06", ticker, "Short Convexity", "0.94 BTC", positionMetrics.entryReferencePrice.toFixed(2)] },
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

  return `${action} convexity ${Math.round(exposureMetrics.convexNotionalUsd).toLocaleString("en-US")} USDC notional, ${exposureMetrics.deltaEquivalentBtc.toFixed(2)} BTC delta eq on ${ticker}`;
}

function getIndexDigits(_symbol: string) {
  return 2;
}

function getPricePrecision(symbol: string) {
  return symbol === "BTC/USD" ? 0 : 2;
}

function getBaseAsset(symbol: string) {
  if (symbol.includes("-")) {
    return symbol.split("USD")[0] ?? symbol;
  }

  return symbol.split("/")[0] ?? symbol;
}

function getInstrumentKeyFromMarketId(marketId: string): keyof typeof INSTRUMENT_MARKETS {
  if (marketId.startsWith("btc-")) {
    return "BTC/USD";
  }

  if (marketId.startsWith("ngn-")) {
    return "NGN/USD";
  }

  return "ETH/USD";
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
  chartContext: (typeof CHART_CONTEXT_TABS)[number],
  liveMark: number,
  liveBasis: number,
  marketCandles: Candle[],
  _liveIndex: number,
) {
  if (chartContext === "Basis") {
    return shiftCandles(marketCandles, liveBasis);
  }

  return shiftCandles(marketCandles, liveMark);
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
  symbol: string,
  timeframe: (typeof TIMEFRAME_OPTIONS)[number],
) {
  const lastCandle = candles.at(-1);

  if (!lastCandle) {
    return candles;
  }

  const precision = getPricePrecision(symbol);
  let timeframeScale = 1;

  if (timeframe === "5m") {
    timeframeScale = 0.7;
  } else if (timeframe === "D") {
    timeframeScale = 1.8;
  }

  const drift = (symbol === "BTC/USD" ? 42 : 3.8) * timeframeScale;
  const volatility = (symbol === "BTC/USD" ? 88 : 11.5) * timeframeScale;
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
  _marketType: "Futures",
  symbol: string,
  liveBasis: number,
  liveIndex: number,
) {
  return infoBar.map((item: MarketStat) => {
    if (item.label === "Mark Price") {
      return { ...item, value: formatPrice(liveIndex + liveBasis, getIndexDigits(symbol)) };
    }

    return item;
  });
}

function getDeliveryValue(positionOverview: DeliveryTerm[], label: string) {
  return positionOverview.find((item) => item.label === label)?.value ?? "";
}

function buildPositionOverview(positionMetrics: ConvexExposureMetrics) {
  return [
    { label: "Entry Reference", value: positionMetrics.entryReferencePrice.toFixed(2) },
    { label: "Convex Notional", value: `$${Math.round(positionMetrics.convexNotionalUsd).toLocaleString("en-US")}` },
    { label: "Delta Equivalent", value: `${positionMetrics.deltaEquivalentBtc.toFixed(2)} BTC` },
    { label: "Convexity Exposure", value: `$${positionMetrics.convexityExposurePer1PctSquared.toFixed(0)} / 1%²` },
    { label: "Mark Price", value: positionMetrics.markPrice.toFixed(2) },
    { label: "Unrealized PnL", value: `${positionMetrics.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(positionMetrics.pnlUsd).toFixed(0)}` },
  ] satisfies DeliveryTerm[];
}

function resolveLiveMarketPrices({
  btcSnapshot,
  market,
  ngnSnapshot,
  selectedSymbol,
}: {
  btcSnapshot: BtcSquaredPerpSnapshot | null;
  market: (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS][keyof (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS]];
  ngnSnapshot: NgnPerpSnapshot | null;
  selectedSymbol: keyof typeof INSTRUMENT_MARKETS;
}) {
  let liveIndex = parseNumericString(market.index);
  let liveMark = parseNumericString(market.mark);

  if (selectedSymbol === "BTC/USD" && btcSnapshot !== null) {
    liveIndex = btcSnapshot.displayIndexBtcUsd;
    liveMark = btcSnapshot.displayMarkBtcUsd;
  } else if (selectedSymbol === "NGN/USD" && ngnSnapshot !== null) {
    liveIndex = ngnSnapshot.displayIndexNgnPerUsd;
    liveMark = ngnSnapshot.displayMarkNgnPerUsd;
  }

  return { liveIndex, liveMark };
}

function buildDynamicMarketOptions({
  btcSnapshot,
  ngnSnapshot,
}: {
  btcSnapshot: BtcSquaredPerpSnapshot | null;
  ngnSnapshot: NgnPerpSnapshot | null;
}) {
  return MARKET_OPTIONS.map((marketOption) => {
    if (marketOption.id === "btc-usd-futures" && btcSnapshot !== null) {
      return {
        ...marketOption,
        lastPrice: formatPrice(btcSnapshot.displayMarkBtcUsd, 2),
      };
    }

    if (marketOption.id === "ngn-usdc-perp-futures" && ngnSnapshot !== null) {
      return {
        ...marketOption,
        lastPrice: formatPrice(ngnSnapshot.displayMarkNgnPerUsd, 2),
      };
    }

    return marketOption;
  });
}

function buildTerminalViewModel({
  btcOrderBook,
  btcSnapshot,
  market,
  ngnSnapshot,
  selectedMarketId,
  selectedSymbol,
  size,
  sizingMode,
  tradeSide,
}: {
  btcOrderBook: MatchingBackendOrderBookSnapshot | null;
  btcSnapshot: BtcSquaredPerpSnapshot | null;
  market: (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS][keyof (typeof INSTRUMENT_MARKETS)[keyof typeof INSTRUMENT_MARKETS]];
  ngnSnapshot: NgnPerpSnapshot | null;
  selectedMarketId: string;
  selectedSymbol: keyof typeof INSTRUMENT_MARKETS;
  size: string;
  sizingMode: ConvexSizingMode;
  tradeSide: "buy" | "sell";
}) {
  const selectedMarket =
    MARKET_OPTIONS.find((marketOption) => marketOption.id === selectedMarketId) ??
    MARKET_OPTIONS[0];
  const isBtcSquaredMarket = selectedMarketId === "btc-usd-futures";
  const liveBtcOrderBook = isBtcSquaredMarket && btcOrderBook !== null;
  const { liveIndex, liveMark } = resolveLiveMarketPrices({
    btcSnapshot,
    market,
    ngnSnapshot,
    selectedSymbol,
  });
  const dynamicMarketOptions = buildDynamicMarketOptions({
    btcSnapshot,
    ngnSnapshot,
  });
  const positionEntryReference = parseDisplayNumber(
    getDeliveryValue(market.positionOverview, "Entry Reference"),
  );
  const positionConvexNotional = parseDisplayNumber(
    getDeliveryValue(market.positionOverview, "Convex Notional"),
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
    isBtcSquaredMarket,
    liveIndex,
    liveMark,
    orderPreviewMetrics,
    selectedMarket,
  };
}

type SelectedContract = (typeof CONTRACT_LABELS)[number];
const BTC_MARKET_POLL_INTERVAL_MS = 5000;
const NGN_MARKET_POLL_INTERVAL_MS = 30_000;

export function TradingTerminal({
  initialBtcOrderBook,
  initialBtcSnapshot,
  initialNgnSnapshot,
}: {
  initialBtcOrderBook: MatchingBackendOrderBookSnapshot | null;
  initialBtcSnapshot: BtcSquaredPerpSnapshot | null;
  initialNgnSnapshot: NgnPerpSnapshot | null;
}) {
  const { authenticated, ready: privyReady } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const [selectedMarketId, setSelectedMarketId] = useState("btc-usd-futures");
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
  const [btcOrderBook, setBtcOrderBook] = useState<MatchingBackendOrderBookSnapshot | null>(initialBtcOrderBook);
  const [btcSnapshot, setBtcSnapshot] = useState<BtcSquaredPerpSnapshot | null>(initialBtcSnapshot);
  const [ngnSnapshot, setNgnSnapshot] = useState<NgnPerpSnapshot | null>(initialNgnSnapshot);

  const market = INSTRUMENT_MARKETS[selectedSymbol][selectedContract];
  const {
    currentPositionMetrics,
    displayOrderBook,
    dynamicMarketOptions,
    dynamicPositionOverview,
    isBtcSquaredMarket,
    liveIndex,
    liveMark,
    orderPreviewMetrics,
    selectedMarket,
  } = buildTerminalViewModel({
    btcOrderBook,
    btcSnapshot,
    market,
    ngnSnapshot,
    selectedMarketId,
    selectedSymbol,
    size,
    sizingMode,
    tradeSide,
  });
  const displayTicker = selectedMarket.symbol;
  const liveBasis = liveMark - liveIndex;
  const lastAction = buildTradeStatus(tradeSide, displayTicker, orderPreviewMetrics);
  const dynamicActivityViews = buildActivityViews(
    displayTicker,
    orderPreviewMetrics,
    currentPositionMetrics,
  );
  const displayCandles = getDisplayCandles(
    chartContext,
    liveMark,
    liveBasis,
    market.candles,
    liveIndex,
  );

  const liveInfoBar = buildLiveInfoBar(
    market.infoBar,
    selectedMarket.marketType,
    selectedSymbol,
    liveBasis,
    liveIndex,
  );
  const [liveCandles, setLiveCandles] = useState<Candle[]>(displayCandles);
  const displayOrderBookAsks = displayOrderBook.asks;
  const displayOrderBookBids = displayOrderBook.bids;
  const walletConnected = privyReady && walletsReady && authenticated && wallets.length > 0;
  const tradeSubmissionEnabled = false;
  let tradeSubmissionNotice = "Order entry is still using static terminal data for this market.";

  if (isBtcSquaredMarket) {
    tradeSubmissionNotice = walletConnected
      ? "Wallet connected. Live convex perpetual depth is coming from matching-backend, but order entry stays read only until Archer wires signed backend actions."
      : "Connect a wallet to prepare for signing. Live convex perpetual depth is coming from matching-backend, but order entry stays read only until Archer wires signed backend actions.";
  }

  const refreshBtcSquaredMarket = useEffectEvent(async function refreshBtcSquaredMarket() {
    try {
      const response = await fetch("/api/markets/btcusdc-sqperp", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      setBtcSnapshot((await response.json()) as BtcSquaredPerpSnapshot);
    } catch {
      // Keep the last good snapshot and let the rest of the UI continue rendering.
    }
  });

  const refreshBtcSquaredOrderBook = useEffectEvent(async function refreshBtcSquaredOrderBook() {
    try {
      const response = await fetch("/api/markets/btcusdc-sqperp/book", {
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

  const refreshNgnMarket = useEffectEvent(async function refreshNgnMarket() {
    try {
      const response = await fetch("/api/markets/ngnusdc", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      setNgnSnapshot((await response.json()) as NgnPerpSnapshot);
    } catch {
      // Keep the last good snapshot and let the rest of the UI continue rendering.
    }
  });

  useEffect(() => {
    setLiveCandles(
      getDisplayCandles(
        chartContext,
        liveMark,
        liveBasis,
        market.candles,
        liveIndex,
      ),
    );
  }, [
    chartContext,
    liveMark,
    liveBasis,
    liveIndex,
    market.candles,
    selectedContract,
    selectedMarketId,
    selectedSymbol,
    timeframe,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveCandles((currentCandles) => simulateLiveCandles(currentCandles, selectedSymbol, timeframe));
    }, getChartUpdateInterval(timeframe));

    return () => window.clearInterval(intervalId);
  }, [selectedSymbol, selectedMarketId, timeframe, chartContext]);

  useEffect(() => {
    if (selectedSymbol !== "BTC/USD") {
      return;
    }

    void refreshBtcSquaredMarket();
    void refreshBtcSquaredOrderBook();

    const intervalId = window.setInterval(() => {
      void refreshBtcSquaredMarket();
      void refreshBtcSquaredOrderBook();
    }, BTC_MARKET_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedSymbol]);

  useEffect(() => {
    setOrderBookDisplayMode(market.presentation?.displayMode ?? "price");
    setSizingMode(market.presentation?.sizingModes?.[0] ?? "notional");
    setSize(market.presentation?.variant === "convex" ? "64000" : "1");
  }, [market.presentation, selectedContract, selectedMarketId, selectedSymbol]);

  useEffect(() => {
    if (selectedSymbol !== "NGN/USD") {
      return;
    }

    void refreshNgnMarket();

    const intervalId = window.setInterval(() => {
      void refreshNgnMarket();
    }, NGN_MARKET_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedSymbol]);

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
      <LiveTabTitle pair={selectedSymbol} price={liveCandles.at(-1)?.close ?? null} />

      <div className="mx-auto flex min-h-screen w-full max-w-none flex-col p-2 xl:h-screen xl:overflow-hidden">
        <MarketHeader
          contractTabs={CONTRACT_TABS}
          currentContract={selectedContract}
          currentMarketId={selectedMarketId}
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
              expandedChart={expandedChart}
              indicatorsEnabled={indicatorsEnabled}
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
              trades={market.trades}
              view={orderBookView}
              onDisplayModeChange={setOrderBookDisplayMode}
              onViewChange={setOrderBookView}
            />
          </div>

          <div className="min-h-[420px] xl:min-h-0 xl:overflow-hidden">
            <TradePanel
              baseAsset={getBaseAsset(selectedSymbol)}
              allocation={allocation}
              contractDetails={market.contractDetails}
              contractLabel={displayTicker}
              executionMode={tradeSubmissionEnabled ? "ready" : "disabled"}
              exposureMetrics={orderPreviewMetrics}
              lastAction={lastAction}
              orderType={orderType}
              positionOverview={dynamicPositionOverview}
              postOnly={postOnly}
              quoteAsset="USDC"
              settlementWallet="USDC Margin"
              size={size}
              sizingMode={sizingMode}
              submissionEnabled={tradeSubmissionEnabled}
              submissionNotice={tradeSubmissionNotice}
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
