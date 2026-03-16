"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { CHART_CONTEXT_TABS, CHART_RANGE_BUTTONS, TIMEFRAME_OPTIONS } from "@/lib/mock-trading-data";
import type { CONTRACT_LABELS } from "@/lib/mock-trading-data";
import type { BtcSquaredPerpSnapshot, Candle, DeliveryTerm, MarketStat, NgnSquaredPerpSnapshot } from "@/lib/trading.types";
import {
  ACTIVITY_VIEWS,
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

function formatPrice(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function parseNumericString(value: string) {
  return Number(value.replaceAll(",", "").replaceAll("$", "").replaceAll("+", ""));
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

function buildActivityViews(ticker: string, positionValue: string, entryPrice: string, markPrice: string, pnl: string) {
  const baseAsset = getBaseAsset(ticker);

  return {
    "open-orders": {
      ...ACTIVITY_VIEWS["open-orders"],
      rows: [{ cells: [ticker, `Buy ${baseAsset}`, "Limit", "1.50", entryPrice] }],
    },
    positions: {
      ...ACTIVITY_VIEWS.positions,
      rows: [{ cells: [ticker, positionValue, entryPrice, markPrice, pnl], positiveCellIndexes: [4] }],
    },
    "trade-history": {
      ...ACTIVITY_VIEWS["trade-history"],
      rows: [
        { cells: ["10:08:14", ticker, `Buy ${baseAsset}`, "2.00", markPrice] },
        { cells: ["10:08:06", ticker, `Sell ${baseAsset}`, "1.25", entryPrice] },
      ],
    },
  };
}

function buildTradeStatus(side: "buy" | "sell", size: string, symbol: string, ticker: string) {
  const normalizedSize = Number(size || "0").toLocaleString("en-US");
  const action = side === "buy" ? "Long" : "Short";

  return `${action} ${normalizedSize} ${getBaseAsset(symbol)} on ${ticker}`;
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

function replaceDeliveryValue(positionOverview: DeliveryTerm[], label: string, value: string) {
  return positionOverview.map((item) => (item.label === label ? { ...item, value } : item));
}

type SelectedContract = (typeof CONTRACT_LABELS)[number];
const BTC_MARKET_POLL_INTERVAL_MS = 5000;
const NGN_MARKET_POLL_INTERVAL_MS = 30_000;

export function TradingTerminal({
  initialBtcSnapshot,
  initialNgnSnapshot,
}: {
  initialBtcSnapshot: BtcSquaredPerpSnapshot | null;
  initialNgnSnapshot: NgnSquaredPerpSnapshot | null;
}) {
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
  const [orderType, setOrderType] = useState<"Limit" | "Market" | "Stop">(DEFAULT_ORDER_TYPE);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("1");
  const [allocation, setAllocation] = useState(20);
  const [postOnly, setPostOnly] = useState(false);
  const [selectedBottomTab, setSelectedBottomTab] =
    useState<keyof typeof ACTIVITY_VIEWS>(DEFAULT_BOTTOM_TAB);
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>(DEFAULT_FILTER);
  const [btcSnapshot, setBtcSnapshot] = useState<BtcSquaredPerpSnapshot | null>(initialBtcSnapshot);
  const [ngnSnapshot, setNgnSnapshot] = useState<NgnSquaredPerpSnapshot | null>(initialNgnSnapshot);

  const selectedMarket =
    MARKET_OPTIONS.find((marketOption) => marketOption.id === selectedMarketId) ??
    MARKET_OPTIONS[0];
  const market = INSTRUMENT_MARKETS[selectedSymbol][selectedContract];
  const displayTicker = selectedMarket.symbol;
  const liveBtcMarket = selectedSymbol === "BTC/USD" && btcSnapshot !== null;
  const liveNgnMarket = selectedSymbol === "NGN/USD" && ngnSnapshot !== null;
  const lastAction = buildTradeStatus(tradeSide, size, selectedSymbol, displayTicker);
  let liveIndex = parseNumericString(market.index);
  let liveMark = parseNumericString(market.mark);

  if (liveBtcMarket) {
    liveIndex = btcSnapshot.displayIndexBtcUsd;
    liveMark = btcSnapshot.displayMarkBtcUsd;
  } else if (liveNgnMarket) {
    liveIndex = ngnSnapshot.displayIndexNgnPerUsd;
    liveMark = ngnSnapshot.displayMarkNgnPerUsd;
  }
  const liveBasis = liveMark - liveIndex;
  const dynamicMarketOptions = MARKET_OPTIONS.map((marketOption) => {
    if (marketOption.id === "btc-usd-futures" && btcSnapshot !== null) {
      return {
        ...marketOption,
        lastPrice: formatPrice(btcSnapshot.displayMarkBtcUsd, 2),
      };
    }

    if ((marketOption.id === "ngn-usdc-sqperp-futures" || marketOption.id === "ngn-usdc-perp-futures") && ngnSnapshot !== null) {
      return {
        ...marketOption,
        lastPrice: formatPrice(ngnSnapshot.displayMarkNgnPerUsd, 2),
      };
    }

    return marketOption;
  });
  const dynamicPositionOverview = replaceDeliveryValue(
    market.positionOverview,
    "Mark Price",
    liveMark.toFixed(2),
  );
  const dynamicActivityViews = buildActivityViews(
    displayTicker,
    dynamicPositionOverview[0]?.value ?? "",
    dynamicPositionOverview[1]?.value ?? "",
    dynamicPositionOverview[2]?.value ?? "",
    dynamicPositionOverview[3]?.value ?? "",
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

  const refreshNgnMarket = useEffectEvent(async function refreshNgnMarket() {
    try {
      const response = await fetch("/api/markets/ngnusdc", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      setNgnSnapshot((await response.json()) as NgnSquaredPerpSnapshot);
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

    const intervalId = window.setInterval(() => {
      void refreshBtcSquaredMarket();
    }, BTC_MARKET_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedSymbol]);

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
              asks={market.orderBookAsks}
              bids={market.orderBookBids}
              contractLabel={selectedContract}
              trades={market.trades}
              view={orderBookView}
              onViewChange={setOrderBookView}
            />
          </div>

          <div className="min-h-[420px] xl:min-h-0 xl:overflow-hidden">
            <TradePanel
              baseAsset={getBaseAsset(selectedSymbol)}
              allocation={allocation}
              contractDetails={market.contractDetails}
              contractLabel={displayTicker}
              markPrice={formatPrice(liveMark, getPricePrecision(selectedSymbol))}
              lastAction={lastAction}
              orderType={orderType}
              positionOverview={dynamicPositionOverview}
              postOnly={postOnly}
              quoteAsset="USDC"
              settlementWallet="USDC Margin"
              size={size}
              tradeSide={tradeSide}
              onAllocationChange={setAllocation}
              onOrderTypeChange={setOrderType}
              onPostOnlyToggle={() => setPostOnly((current) => !current)}
              onSideChange={setTradeSide}
              onSizeChange={setSize}
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
