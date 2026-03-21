import { useState } from "react";
import {
  formatVariancePrice,
  formatVolPercentFromVariance,
} from "@/lib/btcvar30-display";
import type { TIMEFRAME_OPTIONS } from "@/lib/mock-trading-data";
import type {
  Candle,
  ChartDisplayMode,
  ConvexExposureMetrics,
  ConvexRiskModel,
  MarketSemantics,
} from "@/lib/trading.types";
import { CHART_CONTEXT_TABS, CHART_RANGE_BUTTONS } from "@/lib/mock-trading-data";
import { cn } from "@/lib/cn";
import { ChartToolbar } from "@/ui/trading-terminal/ChartToolbar";
import { ConvexityMetricBadge } from "@/ui/trading-terminal/ConvexityMetricBadge";

type Point = {
  closeY: number;
  highY: number;
  lowY: number;
  openY: number;
  volumeHeight: number;
  x: number;
};

function getCurrentMarkSummary(
  chartContext: ChartDisplayMode,
  exposureMetrics: ConvexExposureMetrics | undefined,
  lastClose: number,
) {
  if (chartContext === "Vol" && exposureMetrics) {
    return formatVolPercentFromVariance(exposureMetrics.markVariance);
  }

  if (chartContext === "Variance" && exposureMetrics) {
    return formatVariancePrice(exposureMetrics.markVariance);
  }

  return formatChartValue(lastClose, chartContext);
}

function formatChartValue(value: number, chartContext: ChartDisplayMode) {
  if (chartContext === "Vol") {
    return `${value.toFixed(2)}%`;
  }

  if (chartContext === "Variance") {
    return formatVariancePrice(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function getAxisLabel(chartContext: ChartDisplayMode) {
  if (chartContext === "Vol") {
    return "Implied Vol (30D)";
  }

  if (chartContext === "Variance") {
    return "Implied Variance";
  }

  return "BTC Spot";
}

function getChartHint(chartContext: ChartDisplayMode) {
  if (chartContext === "Vol") {
    return "Displayed in annualized volatility terms";
  }

  if (chartContext === "Variance") {
    return "Matched and settled in implied variance";
  }

  return "Reference BTC spot context";
}

function getPriceDomain(candles: Candle[]) {
  const low = Math.min(...candles.map((candle) => candle.low));
  const high = Math.max(...candles.map((candle) => candle.high));
  const range = Math.max(high - low, 0.5);
  const padding = Math.max(range * 0.18, range < 2 ? 0.4 : 0.8);

  return {
    maxPrice: high + padding,
    minPrice: low - padding,
  };
}

function getChangeLabel(candles: Candle[], chartContext: ChartDisplayMode) {
  const firstCandle = candles[0];
  const lastCandle = candles.at(-1);

  if (!firstCandle || !lastCandle) {
    return { delta: "0.0", percent: "0.00%", positive: true };
  }

  const delta = lastCandle.close - firstCandle.open;
  const percent = firstCandle.open === 0 ? 0 : (delta / firstCandle.open) * 100;

  return {
    delta: `${delta >= 0 ? "+" : ""}${formatChartValue(Math.abs(delta), chartContext)}`,
    percent: `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`,
    positive: delta >= 0,
  };
}

function getChartPoint({
  candle,
  chartBottom,
  chartTop,
  index,
  maxPrice,
  maxVolume,
  priceRange,
  stepX,
  volumeHeight,
}: {
  candle: Candle;
  chartBottom: number;
  chartTop: number;
  index: number;
  maxPrice: number;
  maxVolume: number;
  priceRange: number;
  stepX: number;
  volumeHeight: number;
}) {
  const x = index * stepX + stepX / 2;

  return {
    closeY: chartTop + ((maxPrice - candle.close) / priceRange) * (chartBottom - chartTop),
    highY: chartTop + ((maxPrice - candle.high) / priceRange) * (chartBottom - chartTop),
    lowY: chartTop + ((maxPrice - candle.low) / priceRange) * (chartBottom - chartTop),
    openY: chartTop + ((maxPrice - candle.open) / priceRange) * (chartBottom - chartTop),
    volumeHeight: (candle.volume / maxVolume) * (volumeHeight - 12),
    x,
  } satisfies Point;
}

function getHoverImpact(exposureMetrics: ConvexExposureMetrics | undefined, hoverClose: number | null) {
  if (!exposureMetrics || hoverClose === null) {
    return 0;
  }

  return (
    exposureMetrics.convexNotionalUsd *
    (((hoverClose / exposureMetrics.entryReferencePrice) ** 2) -
      ((exposureMetrics.markPrice / exposureMetrics.entryReferencePrice) ** 2)) *
    (exposureMetrics.side === "buy" ? 1 : -1)
  );
}

function renderAxisValues({
  axisValues,
  chartBottom,
  chartContext,
  chartTop,
  maxPrice,
  priceRange,
  width,
}: {
  axisValues: number[];
  chartBottom: number;
  chartContext: ChartDisplayMode;
  chartTop: number;
  maxPrice: number;
  priceRange: number;
  width: number;
}) {
  return axisValues.map((value) => {
    const y = chartTop + ((maxPrice - value) / priceRange) * (chartBottom - chartTop);

    return (
      <g key={value}>
        <line stroke="#16202A" strokeDasharray="4 6" x1="0" x2={width} y1={y} y2={y} />
        <text fill="#6B7280" fontSize="11" textAnchor="end" x={width - 8} y={y - 6}>
          {formatChartValue(value, chartContext)}
        </text>
      </g>
    );
  });
}

function renderCandles({
  candleWidth,
  candles,
  height,
  points,
}: {
  candleWidth: number;
  candles: Candle[];
  height: number;
  points: Point[];
}) {
  return points.map((point, index) => {
    const candle = candles[index];
    const isBullish = candle.close >= candle.open;
    const bodyTop = Math.min(point.openY, point.closeY);
    const bodyHeight = Math.max(Math.abs(point.closeY - point.openY), 3);
    const color = isBullish ? "#15803D" : "#B91C1C";
    const volumeY = height - point.volumeHeight - 18;

    return (
      <g key={`${candle.time}-${index}`}>
        <line stroke={color} strokeWidth="1.5" x1={point.x} x2={point.x} y1={point.highY} y2={point.lowY} />
        <rect
          fill={color}
          height={bodyHeight}
          rx="1"
          width={candleWidth}
          x={point.x - candleWidth / 2}
          y={bodyTop}
        />
        <rect
          fill={isBullish ? "#123524" : "#4D1717"}
          height={point.volumeHeight}
          opacity="0.72"
          width={Math.max(6, candleWidth)}
          x={point.x - Math.max(6, candleWidth) / 2}
          y={volumeY}
        />
      </g>
    );
  });
}

function renderTimeLabels({
  candles,
  height,
  stepX,
}: {
  candles: Candle[];
  height: number;
  stepX: number;
}) {
  return candles.filter((_, index) => index % 4 === 0).map((candle, index) => {
    const sourceIndex = index * 4;
    const x = sourceIndex * stepX + stepX / 2;

    return (
      <text
        fill="#6B7280"
        fontSize="11"
        key={`${candle.time}-${sourceIndex}`}
        textAnchor="middle"
        x={x}
        y={height - 4}
      >
        {candle.time}
      </text>
    );
  });
}

function ChartOverlays({
  changeLabel,
  chartContext,
  exposureMetrics,
  lastCandle,
  riskModel,
  semantics,
  ticker,
  timeframe,
}: {
  changeLabel: { delta: string; percent: string; positive: boolean };
  chartContext: ChartDisplayMode;
  exposureMetrics?: ConvexExposureMetrics;
  lastCandle: Candle;
  riskModel?: ConvexRiskModel;
  semantics?: MarketSemantics;
  ticker: string;
  timeframe: (typeof TIMEFRAME_OPTIONS)[number];
}) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-[11px]">
        <span className="font-semibold text-[#E5E7EB]">
          {ticker} · {timeframe} · {getAxisLabel(chartContext)}
        </span>
        <span className="text-[#6B7280]">
          O{formatChartValue(lastCandle.open, chartContext)} H{formatChartValue(lastCandle.high, chartContext)} L
          {formatChartValue(lastCandle.low, chartContext)} C{formatChartValue(lastCandle.close, chartContext)}
          <span className={cn("ml-2", changeLabel.positive ? "text-[#8CC9A3]" : "text-[#F0A0A0]")}>
            {changeLabel.delta} ({changeLabel.percent})
          </span>
        </span>
      </div>

      {exposureMetrics && riskModel ? (
        <div className="absolute top-9 left-3 z-10 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
          <ConvexityMetricBadge label="Mark Vol" value={formatVolPercentFromVariance(exposureMetrics.markVariance)} />
          <ConvexityMetricBadge label="Variance Mark" value={formatVariancePrice(exposureMetrics.markVariance)} />
          <ConvexityMetricBadge label="Funding" value={`${riskModel.fundingRateBps.toFixed(2)} bps`} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute top-9 right-4 z-10 text-right">
        <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.12em]">{getAxisLabel(chartContext)}</div>
        <div className="text-[#D1D5DB] text-[11px]">{getChartHint(chartContext)}</div>
        {semantics ? <div className="text-[#60A5FA] text-[10px]">{semantics.infoHint}</div> : null}
      </div>
    </>
  );
}

function HoverCard({
  chartContext,
  exposureMetrics,
  height,
  hoverCandle,
  hoverImpact,
  hoverMovePercent,
  hoverPoint,
  width,
}: {
  chartContext: ChartDisplayMode;
  exposureMetrics?: ConvexExposureMetrics;
  height: number;
  hoverCandle: Candle | null;
  hoverImpact: number;
  hoverMovePercent: number;
  hoverPoint: Point | null;
  width: number;
}) {
  if (!hoverPoint || !hoverCandle) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-sm border border-[#1B2430] bg-[#0E141C]/95 px-2 py-1.5 text-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      style={{
        left: `min(calc(${((hoverPoint.x + 12) / width) * 100}% + 0px), calc(100% - 172px))`,
        top: Math.max(56, Math.min(hoverPoint.closeY - 16, height - 120)),
      }}
    >
      <div className="font-medium text-[#E5E7EB]">{hoverCandle.time}</div>
      <div className="text-[#9CA3AF]">
        {getAxisLabel(chartContext)} {formatChartValue(hoverCandle.close, chartContext)}
      </div>
      {chartContext !== "Vol" ? (
        <div className="text-[#9CA3AF]">Equivalent Vol {formatVolPercentFromVariance(hoverCandle.close)}</div>
      ) : null}
      <div className="text-[#9CA3AF]">Move {hoverMovePercent >= 0 ? "+" : ""}{hoverMovePercent.toFixed(2)}%</div>
      {exposureMetrics ? (
        <div className={cn("font-medium", hoverImpact >= 0 ? "text-[#8CC9A3]" : "text-[#F0A0A0]")}>
          Position impact {hoverImpact >= 0 ? "+" : "-"}${Math.abs(hoverImpact).toFixed(0)}
        </div>
      ) : null}
    </div>
  );
}

function TradingChart({
  candles,
  chartContext,
  exposureMetrics,
  riskModel,
  semantics,
  timeframe,
  ticker,
}: {
  candles: Candle[];
  chartContext: ChartDisplayMode;
  exposureMetrics?: ConvexExposureMetrics;
  riskModel?: ConvexRiskModel;
  semantics?: MarketSemantics;
  timeframe: (typeof TIMEFRAME_OPTIONS)[number];
  ticker: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 920;
  const height = 620;
  const volumeHeight = 128;
  const rightAxisGutter = 96;
  const plotWidth = width - rightAxisGutter;
  const chartTop = 28;
  const chartBottom = height - volumeHeight - 28;
  const { maxPrice, minPrice } = getPriceDomain(candles);
  const priceRange = maxPrice - minPrice;
  const stepX = plotWidth / candles.length;
  const candleWidth = Math.max(9, stepX * 0.62);
  const maxVolume = Math.max(...candles.map((candle) => candle.volume));
  const lastCandle = candles.at(-1);
  const changeLabel = getChangeLabel(candles, chartContext);

  if (!lastCandle) {
    return null;
  }

  const points = candles.map((candle, index) =>
    getChartPoint({
      candle,
      chartBottom,
      chartTop,
      index,
      maxPrice,
      maxVolume,
      priceRange,
      stepX,
      volumeHeight,
    }),
  );
  const currentPriceY =
    chartTop + ((maxPrice - lastCandle.close) / priceRange) * (chartBottom - chartTop);
  const axisValues = Array.from({ length: 6 }, (_, index) => maxPrice - (priceRange / 5) * index);
  const hoverPoint = hoverIndex === null ? null : points[hoverIndex];
  const hoverCandle = hoverIndex === null ? null : candles[hoverIndex];
  const hoverMovePercent =
    hoverCandle && exposureMetrics ? ((hoverCandle.close - candles[0].open) / candles[0].open) * 100 : 0;
  const hoverImpact = getHoverImpact(exposureMetrics, hoverCandle?.close ?? null);
  const currentMarkSummary = getCurrentMarkSummary(chartContext, exposureMetrics, lastCandle.close);

  return (
    <div className="relative flex-1 overflow-hidden">
      <ChartOverlays
        changeLabel={changeLabel}
        chartContext={chartContext}
        exposureMetrics={exposureMetrics}
        lastCandle={lastCandle}
        riskModel={riskModel}
        semantics={semantics}
        ticker={ticker}
        timeframe={timeframe}
      />

      <div
        className="size-full"
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const localX = ((event.clientX - bounds.left) / bounds.width) * width;
          const nextIndex = Math.max(0, Math.min(candles.length - 1, Math.floor(localX / stepX)));
          setHoverIndex(nextIndex);
        }}
      >
        <svg
          aria-label={`${ticker} ${getAxisLabel(chartContext)} chart`}
          className="size-full"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <pattern height="68" id="gridPattern" patternUnits="userSpaceOnUse" width="92">
              <path d="M 92 0 L 0 0 0 68" fill="none" stroke="#16202A" strokeWidth="0.7" />
            </pattern>
          </defs>

          <rect fill="url(#gridPattern)" height={height} width={width} x="0" y="0" />

          {renderAxisValues({
            axisValues,
            chartBottom,
            chartContext,
            chartTop,
            maxPrice,
            priceRange,
            width,
          })}

          <text fill="#6B7280" fontSize="11" textAnchor="start" x="10" y="20">
            {getAxisLabel(chartContext)}
          </text>

          {renderCandles({
            candleWidth,
            candles,
            height,
            points,
          })}

          <line
            stroke="#3B82F6"
            strokeDasharray="3 5"
            strokeWidth="1"
            x1="0"
            x2={plotWidth}
            y1={currentPriceY}
            y2={currentPriceY}
          />

          {hoverPoint ? (
            <line
              stroke="#334155"
              strokeDasharray="4 4"
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={chartTop}
              y2={height - 18}
            />
          ) : null}

          <g>
            <rect fill="#1D4ED8" height="22" rx="4" width="84" x={width - 90} y={currentPriceY - 11} />
            <text fill="#EFF6FF" fontSize="12" fontWeight="700" textAnchor="middle" x={width - 48} y={currentPriceY + 4}>
              {currentMarkSummary}
            </text>
          </g>

          {renderTimeLabels({
            candles,
            height,
            stepX,
          })}
        </svg>
      </div>

      <HoverCard
        chartContext={chartContext}
        exposureMetrics={exposureMetrics}
        height={height}
        hoverCandle={hoverCandle}
        hoverImpact={hoverImpact}
        hoverMovePercent={hoverMovePercent}
        hoverPoint={hoverPoint}
        width={width}
      />
    </div>
  );
}

export function ChartPanel({
  candles,
  chartContext,
  exposureMetrics,
  expandedChart,
  indicatorsEnabled,
  riskModel,
  semantics,
  selectedRange,
  selectedTimeframe,
  selectedTool,
  ticker,
  onChartContextChange,
  onExpandedToggle,
  onIndicatorsToggle,
  onRangeChange,
  onTimeframeChange,
  onToolSelect,
}: {
  candles: Candle[];
  chartContext: ChartDisplayMode;
  exposureMetrics?: ConvexExposureMetrics;
  expandedChart: boolean;
  indicatorsEnabled: boolean;
  riskModel?: ConvexRiskModel;
  semantics?: MarketSemantics;
  selectedRange: (typeof CHART_RANGE_BUTTONS)[number];
  selectedTimeframe: (typeof TIMEFRAME_OPTIONS)[number];
  selectedTool: string;
  ticker: string;
  onChartContextChange: (context: ChartDisplayMode) => void;
  onExpandedToggle: () => void;
  onIndicatorsToggle: () => void;
  onRangeChange: (range: (typeof CHART_RANGE_BUTTONS)[number]) => void;
  onTimeframeChange: (timeframe: (typeof TIMEFRAME_OPTIONS)[number]) => void;
  onToolSelect: (toolId: string) => void;
}) {
  return (
    <section className="flex h-full min-h-[540px] flex-col overflow-hidden rounded-md border border-[#1B2430] bg-[#0F1720] xl:min-h-0">
      <ChartToolbar
        expandedChart={expandedChart}
        indicatorsEnabled={indicatorsEnabled}
        selectedTimeframe={selectedTimeframe}
        selectedTool={selectedTool}
        onExpandedToggle={onExpandedToggle}
        onIndicatorsToggle={onIndicatorsToggle}
        onTimeframeChange={onTimeframeChange}
        onToolSelect={onToolSelect}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden xl:block">
          <ChartToolbar
            expandedChart={expandedChart}
            indicatorsEnabled={indicatorsEnabled}
            mode="side"
            selectedTimeframe={selectedTimeframe}
            selectedTool={selectedTool}
            onExpandedToggle={onExpandedToggle}
            onIndicatorsToggle={onIndicatorsToggle}
            onTimeframeChange={onTimeframeChange}
            onToolSelect={onToolSelect}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-[#1B2430] border-b bg-[#0F1720] px-2.5 py-1">
            <div className="flex items-center gap-1">
              {CHART_CONTEXT_TABS.map((tab) => (
                <button
                  className={cn(
                    "rounded-sm px-2 py-1 font-medium text-[#6B7280] text-[11px] transition-colors hover:bg-[#11161D] hover:text-[#D1D5DB]",
                    chartContext === tab && "bg-[#11161D] text-[#BFDBFE]",
                  )}
                  key={tab}
                  onClick={() => onChartContextChange(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="text-[#6B7280] text-[11px]">{getChartHint(chartContext)}</div>
          </div>

          <TradingChart
            candles={candles}
            chartContext={chartContext}
            exposureMetrics={exposureMetrics}
            riskModel={riskModel}
            semantics={semantics}
            ticker={ticker}
            timeframe={selectedTimeframe}
          />

          <div className="flex items-center justify-between border-[#1B2430] border-t bg-[#0F1720] px-2.5 py-1 text-[11px]">
            <div className="flex flex-wrap items-center gap-1">
              {CHART_RANGE_BUTTONS.map((range) => (
                <button
                  className={cn(
                    "rounded-sm px-2 py-1 text-[#6B7280] transition-colors hover:bg-[#11161D] hover:text-[#D1D5DB]",
                    selectedRange === range && "bg-[#11161D] text-[#BFDBFE]",
                  )}
                  key={range}
                  onClick={() => onRangeChange(range)}
                  type="button"
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[#6B7280]">
              <span>{indicatorsEnabled ? "Indicators On" : "Indicators Off"}</span>
              <button type="button">%</button>
              <button type="button">log</button>
              <button className="text-[#D1D5DB]" type="button">
                auto
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
