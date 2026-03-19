import { useState } from "react";
import type { TIMEFRAME_OPTIONS } from "@/lib/mock-trading-data";
import type { Candle, ConvexExposureMetrics, ConvexRiskModel } from "@/lib/trading.types";
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

function formatPrice(value: number) {
  let digits = 1;

  if (Math.abs(value) < 10) {
    digits = 4;
  } else if (value % 1 === 0) {
    digits = 0;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function getPriceDomain(candles: Candle[]) {
  const low = Math.min(...candles.map((candle) => candle.low));
  const high = Math.max(...candles.map((candle) => candle.high));
  const range = Math.max(high - low, 0.5);
  const padding = Math.max(range * 0.22, 0.8);

  return {
    maxPrice: high + padding,
    minPrice: low - padding,
  };
}

function getChangeLabel(candles: Candle[]) {
  const firstCandle = candles[0];
  const lastCandle = candles.at(-1);

  if (!firstCandle || !lastCandle) {
    return { delta: "0.0", percent: "0.00%", positive: true };
  }

  const delta = lastCandle.close - firstCandle.open;
  const percent = firstCandle.open === 0 ? 0 : (delta / firstCandle.open) * 100;

  return {
    delta: `${delta >= 0 ? "+" : ""}${formatPrice(delta)}`,
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

function getDeltaBand({
  currentPriceY,
  exposureMetrics,
  lastClose,
  maxPrice,
  minPrice,
  priceRange,
  chartTop,
  chartBottom,
}: {
  currentPriceY: number;
  exposureMetrics?: ConvexExposureMetrics;
  lastClose: number;
  maxPrice: number;
  minPrice: number;
  priceRange: number;
  chartTop: number;
  chartBottom: number;
}) {
  if (!exposureMetrics) {
    return {
      bottomY: currentPriceY,
      topY: currentPriceY,
    };
  }

  const deltaBandWidth = Math.min(Math.abs(exposureMetrics.gammaPer1kMove) * 4000, priceRange * 0.22);

  return {
    bottomY:
      chartTop +
      ((maxPrice - Math.max(lastClose - deltaBandWidth, minPrice)) / priceRange) *
        (chartBottom - chartTop),
    topY:
      chartTop +
      ((maxPrice - Math.min(lastClose + deltaBandWidth, maxPrice)) / priceRange) *
        (chartBottom - chartTop),
  };
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

function TradingChart({
  candles,
  exposureMetrics,
  riskModel,
  timeframe,
  ticker,
}: {
  candles: Candle[];
  exposureMetrics?: ConvexExposureMetrics;
  riskModel?: ConvexRiskModel;
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
  const changeLabel = getChangeLabel(candles);

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
  const deltaBand = getDeltaBand({
    chartBottom,
    chartTop,
    currentPriceY,
    exposureMetrics,
    lastClose: lastCandle.close,
    maxPrice,
    minPrice,
    priceRange,
  });
  const axisValues = Array.from({ length: 6 }, (_, index) => maxPrice - (priceRange / 5) * index);
  const hoverPoint = hoverIndex === null ? null : points[hoverIndex];
  const hoverCandle = hoverIndex === null ? null : candles[hoverIndex];
  const hoverMovePercent =
    hoverCandle && exposureMetrics ? ((hoverCandle.close - exposureMetrics.markPrice) / exposureMetrics.markPrice) * 100 : 0;
  const hoverImpact = getHoverImpact(exposureMetrics, hoverCandle?.close ?? null);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-[11px]">
        <span className="font-semibold text-[#E5E7EB]">
          {ticker} · {timeframe} · Central Limit Order Book
        </span>
        <span className="text-[#6B7280]">
          O{formatPrice(lastCandle.open)} H{formatPrice(lastCandle.high)} L
          {formatPrice(lastCandle.low)} C{formatPrice(lastCandle.close)}
          <span className={cn("ml-2", changeLabel.positive ? "text-[#8CC9A3]" : "text-[#F0A0A0]")}>
            {changeLabel.delta} ({changeLabel.percent})
          </span>
        </span>
      </div>

      {exposureMetrics && riskModel ? (
        <div className="absolute top-9 left-3 z-10 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
          <ConvexityMetricBadge label="Delta band" value={`${exposureMetrics.deltaEquivalentBtc.toFixed(2)} BTC`} />
          <ConvexityMetricBadge
            label="Gamma intensity"
            tooltip="Normalized ladder state combining convexity risk, volatility, and inventory pressure."
            value={riskModel.convexityRisk.toFixed(2)}
          />
          <ConvexityMetricBadge label="Funding" value={`${riskModel.fundingRateBps.toFixed(2)} bps`} />
        </div>
      ) : null}

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
          aria-label={`${ticker} candlestick chart`}
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

          {exposureMetrics ? (
            <rect
              fill="#1D4ED8"
              height={Math.max(deltaBand.bottomY - deltaBand.topY, 1)}
              opacity="0.08"
              width={plotWidth}
              x="0"
              y={deltaBand.topY}
            />
          ) : null}

        {axisValues.map((value) => {
          const y = chartTop + ((maxPrice - value) / priceRange) * (chartBottom - chartTop);

          return (
            <g key={value}>
              <line stroke="#16202A" strokeDasharray="4 6" x1="0" x2={width} y1={y} y2={y} />
              <text fill="#6B7280" fontSize="11" textAnchor="end" x={width - 8} y={y - 6}>
                {formatPrice(value)}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
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
          <rect
            fill="#1D4ED8"
            height="22"
            rx="4"
            width="64"
            x={width - 70}
            y={currentPriceY - 11}
          />
          <text
            fill="#EFF6FF"
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            x={width - 38}
            y={currentPriceY + 4}
          >
            {formatPrice(lastCandle.close)}
          </text>
        </g>

        {candles.filter((_, index) => index % 4 === 0).map((candle, index) => {
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
        })}
        </svg>
      </div>

      {hoverPoint && hoverCandle && exposureMetrics ? (
        <div
          className="pointer-events-none absolute z-20 rounded-sm border border-[#1B2430] bg-[#0E141C]/95 px-2 py-1.5 text-[11px] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          style={{
            left: `min(calc(${((hoverPoint.x + 12) / width) * 100}% + 0px), calc(100% - 172px))`,
            top: Math.max(56, hoverPoint.closeY - 16),
          }}
        >
          <div className="font-medium text-[#E5E7EB]">{hoverCandle.time}</div>
          <div className="text-[#9CA3AF]">Spot {formatPrice(hoverCandle.close)}</div>
          <div className="text-[#9CA3AF]">Move {hoverMovePercent >= 0 ? "+" : ""}{hoverMovePercent.toFixed(2)}%</div>
          <div className={cn("font-medium", hoverImpact >= 0 ? "text-[#8CC9A3]" : "text-[#F0A0A0]")}>
            Position impact {hoverImpact >= 0 ? "+" : "-"}${Math.abs(hoverImpact).toFixed(0)}
          </div>
        </div>
      ) : null}
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
  chartContext: (typeof CHART_CONTEXT_TABS)[number];
  exposureMetrics?: ConvexExposureMetrics;
  expandedChart: boolean;
  indicatorsEnabled: boolean;
  riskModel?: ConvexRiskModel;
  selectedRange: (typeof CHART_RANGE_BUTTONS)[number];
  selectedTimeframe: (typeof TIMEFRAME_OPTIONS)[number];
  selectedTool: string;
  ticker: string;
  onChartContextChange: (context: (typeof CHART_CONTEXT_TABS)[number]) => void;
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
            <div className="text-[#6B7280] text-[11px]">
              {chartContext === "Basis" ? "Mark minus index in USDC" : "Price in USDC"}
            </div>
          </div>

          <TradingChart
            candles={candles}
            exposureMetrics={exposureMetrics}
            riskModel={riskModel}
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
