"use client";

import { startTransition, useEffect, useState } from "react";
import type { ChainlinkSpotSnapshot } from "@/lib/chainlink-ngn-usd";
import type { SpotHistorySnapshot } from "@/lib/exchange-api-history";
import type { CHART_CONTEXT_TABS, CHART_RANGE_BUTTONS, TIMEFRAME_OPTIONS } from "@/lib/mock-trading-data";
import type { CONTRACT_LABELS } from "@/lib/mock-trading-data";
import type { Candle, MarketOption, MarketStat } from "@/lib/trading.types";
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
  return {
    "open-orders": {
      ...ACTIVITY_VIEWS["open-orders"],
      rows: [{ cells: [ticker, "Buy USD", "Limit", "25,000", entryPrice] }],
    },
    positions: {
      ...ACTIVITY_VIEWS.positions,
      rows: [{ cells: [ticker, positionValue, entryPrice, markPrice, pnl], positiveCellIndexes: [4] }],
    },
    "trade-history": {
      ...ACTIVITY_VIEWS["trade-history"],
      rows: [
        { cells: ["10:08:14", ticker, "Buy USD", "50,000", markPrice] },
        { cells: ["10:08:06", ticker, "Sell USD", "35,000", entryPrice] },
      ],
    },
  };
}

function getIndexDigits(symbol: string) {
  return symbol === "NGN/USD" ? 2 : 5;
}

function getDisplayTicker(symbol: string, marketType: "Futures" | "Spot", ticker: string) {
  return marketType === "Spot" ? `${symbol} Spot` : ticker;
}

function getPricePrecision(symbol: string) {
  return symbol === "NGN/USD" ? 2 : 5;
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
  liveBasis: number,
  liveIndex: number,
  marketCandles: Candle[],
  marketType: "Futures" | "Spot",
  selectedSpotHistory: SpotHistorySnapshot | null,
) {
  if (marketType === "Spot" && selectedSpotHistory?.series) {
    return selectedSpotHistory.series;
  }

  if (chartContext === "Spot") {
    return shiftCandles(marketCandles, liveIndex);
  }

  if (chartContext === "Basis") {
    return shiftCandles(marketCandles, liveBasis);
  }

  return marketCandles;
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

  const drift = (symbol === "NGN/USD" ? 0.28 : 0.000_28) * timeframeScale;
  const volatility = (symbol === "NGN/USD" ? 0.42 : 0.000_36) * timeframeScale;
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
  marketType: "Futures" | "Spot",
  symbol: string,
  liveBasis: number,
  liveIndex: number,
) {
  const indexDigits = getIndexDigits(symbol);

  return infoBar.map((item: MarketStat) => {
    if (item.label === "Contract" && marketType === "Spot") {
      return { ...item, value: `${symbol} Spot` };
    }

    if (item.label === "Mark" && marketType === "Spot") {
      return { ...item, value: formatPrice(liveIndex, indexDigits) };
    }

    if (item.label === "Index") {
      return { ...item, value: formatPrice(liveIndex, indexDigits) };
    }

    if (item.label === "Basis" && marketType === "Spot") {
      return { ...item, value: "0.00" };
    }

    if (item.label === "Basis") {
      return { ...item, value: `${liveBasis >= 0 ? "+" : ""}${formatPrice(liveBasis, 2)}` };
    }

    return item;
  });
}

type SelectedContract = (typeof CONTRACT_LABELS)[number];

export function TradingTerminal({
  chainlinkSpot,
  spotHistory,
}: {
  chainlinkSpot: ChainlinkSpotSnapshot | null;
  spotHistory: Record<SpotHistorySnapshot["pair"], SpotHistorySnapshot> | null;
}) {
  const [selectedMarketId, setSelectedMarketId] = useState("ngn-usd-futures");
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
  const [size, setSize] = useState("50000");
  const [allocation, setAllocation] = useState(20);
  const [postOnly, setPostOnly] = useState(false);
  const [atExpiryDeliver, setAtExpiryDeliver] = useState(true);
  const [selectedBottomTab, setSelectedBottomTab] =
    useState<keyof typeof ACTIVITY_VIEWS>(DEFAULT_BOTTOM_TAB);
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>(DEFAULT_FILTER);
  const [lastAction, setLastAction] = useState("Ready");

  const selectedMarket =
    MARKET_OPTIONS.find((marketOption) => marketOption.id === selectedMarketId) ??
    MARKET_OPTIONS[0];
  const market = INSTRUMENT_MARKETS[selectedSymbol][selectedContract];
  const selectedSpotHistory =
    selectedMarket.marketType === "Spot"
      ? (spotHistory?.[selectedSymbol as SpotHistorySnapshot["pair"]] ?? null)
      : null;
  const liveIndex =
    selectedSpotHistory?.latestPrice ??
    (selectedSymbol === "NGN/USD"
      ? (chainlinkSpot?.priceNgnPerUsd ?? parseNumericString(market.index))
      : parseNumericString(market.index));
  const liveMark = parseNumericString(market.mark);
  const liveBasis = liveMark - liveIndex;
  const dynamicMarketOptions = MARKET_OPTIONS.map((marketOption) => {
    const latestSpotPrice =
      spotHistory?.[marketOption.symbol as SpotHistorySnapshot["pair"]]?.latestPrice;

    if (marketOption.marketType !== "Spot" || !latestSpotPrice) {
      return marketOption;
    }

    return {
      ...marketOption,
      lastPrice:
        marketOption.symbol === "NGN/USD"
          ? formatPrice(latestSpotPrice, 2)
          : latestSpotPrice.toFixed(5),
    } satisfies MarketOption;
  });
  const dynamicActivityViews = buildActivityViews(
    getDisplayTicker(selectedSymbol, selectedMarket.marketType, market.ticker),
    market.positionOverview[0]?.value ?? "",
    market.positionOverview[1]?.value ?? "",
    market.positionOverview[2]?.value ?? "",
    market.positionOverview[3]?.value ?? "",
  );
  const displayCandles = getDisplayCandles(
    chartContext,
    liveBasis,
    liveIndex,
    market.candles,
    selectedMarket.marketType,
    selectedSpotHistory,
  );

  const liveInfoBar = buildLiveInfoBar(
    market.infoBar,
    selectedMarket.marketType,
    selectedSymbol,
    liveBasis,
    liveIndex,
  );
  const [liveCandles, setLiveCandles] = useState<Candle[]>(displayCandles);

  useEffect(() => {
    setLiveCandles(
      getDisplayCandles(
        chartContext,
        liveBasis,
        liveIndex,
        market.candles,
        selectedMarket.marketType,
        selectedSpotHistory,
      ),
    );
  }, [
    chartContext,
    liveBasis,
    liveIndex,
    market.candles,
    selectedContract,
    selectedMarket.marketType,
    selectedMarketId,
    selectedSpotHistory,
    selectedSymbol,
    timeframe,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveCandles((currentCandles) => simulateLiveCandles(currentCandles, selectedSymbol, timeframe));
    }, getChartUpdateInterval(timeframe));

    return () => window.clearInterval(intervalId);
  }, [selectedSymbol, selectedMarketId, timeframe, chartContext]);

  function handleContractSelect(contract: string) {
    startTransition(() => {
      setSelectedContract(contract as SelectedContract);
      setLastAction(`Switched to ${selectedSymbol} ${contract}`);
    });
  }

  function handleMarketSelect(marketId: string) {
    const nextMarket = MARKET_OPTIONS.find((marketOption) => marketOption.id === marketId);

    if (!nextMarket) {
      return;
    }

    startTransition(() => {
      setSelectedMarketId(marketId);
      setSelectedSymbol(nextMarket.symbol as keyof typeof INSTRUMENT_MARKETS);
      setSelectedContract(DEFAULT_CONTRACT);
      setChartContext(nextMarket.marketType === "Spot" ? "Spot" : DEFAULT_CHART_CONTEXT);
      setLastAction(`Switched to ${nextMarket.symbol} ${nextMarket.marketType}`);
    });
  }

  function handleFilterCycle() {
    const currentIndex = FILTER_OPTIONS.indexOf(filter);
    const next = FILTER_OPTIONS[(currentIndex + 1) % FILTER_OPTIONS.length];
    setFilter(next);
  }

  function handleSubmit(side: "buy" | "sell") {
    setTradeSide(side);
    setLastAction(
      `${side === "buy" ? "Buy USD" : "Sell USD"} ${Number(size || "0").toLocaleString("en-US")} on ${market.ticker}`,
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1118] text-[#D1D5DB] xl:h-screen xl:overflow-hidden">
      <LiveTabTitle pair={selectedSymbol} price={liveCandles.at(-1)?.close ?? null} />

      <div className="mx-auto flex min-h-screen w-full max-w-none flex-col p-2 xl:h-screen xl:overflow-hidden">
        <MarketHeader
          contractTabs={CONTRACT_TABS}
          currentContract={selectedContract}
          currentMarketId={selectedMarketId}
          currentSymbol={selectedSymbol}
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
              ticker={getDisplayTicker(selectedSymbol, selectedMarket.marketType, market.ticker)}
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
              contractLabel={selectedContract.replace(" ", " ").replace("2026", "26")}
              trades={market.trades}
              view={orderBookView}
              onViewChange={setOrderBookView}
            />
          </div>

          <div className="min-h-[420px] xl:min-h-0 xl:overflow-hidden">
            <TradePanel
              allocation={allocation}
              atExpiryDeliver={atExpiryDeliver}
              contractDetails={market.contractDetails}
              contractLabel={getDisplayTicker(selectedSymbol, selectedMarket.marketType, market.ticker)}
              lastAction={lastAction}
              orderType={orderType}
              positionOverview={market.positionOverview}
              postOnly={postOnly}
              size={size}
              tradeSide={tradeSide}
              onAllocationChange={setAllocation}
              onAtExpiryDeliverToggle={() => setAtExpiryDeliver((current) => !current)}
              onOrderTypeChange={setOrderType}
              onPostOnlyToggle={() => setPostOnly((current) => !current)}
              onSideChange={setTradeSide}
              onSizeChange={setSize}
              onSubmit={handleSubmit}
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
