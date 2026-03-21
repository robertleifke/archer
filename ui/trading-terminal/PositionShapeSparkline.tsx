import { formatVolPercentFromVariance, varianceToVolPercent, volPercentToVariance } from "@/lib/btcvar30-display";
import { getConvexPnlUsd } from "@/lib/convex-perp";
import type { ConvexExposureMetrics } from "@/lib/trading.types";
import { cn } from "@/lib/cn";

function toFiniteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function buildPath(metrics: ConvexExposureMetrics, width: number, height: number) {
  const moves = [-10, -5, -2.5, 0, 2.5, 5, 10];
  const safeMarkPrice = toFiniteNumber(metrics.markPrice, 0);
  const safeEntryReferencePrice = toFiniteNumber(metrics.entryReferencePrice, 0);
  const safeConvexNotionalUsd = toFiniteNumber(metrics.convexNotionalUsd, 0);
  const safeMarkVol = varianceToVolPercent(safeMarkPrice);
  const points = moves.map((move, index) => {
    const scenarioVariance = volPercentToVariance(Math.max(safeMarkVol + move, 0));
    const pnl =
      safeEntryReferencePrice > 0 && safeMarkPrice > 0
        ? getConvexPnlUsd(
            safeConvexNotionalUsd,
            safeEntryReferencePrice,
            scenarioVariance,
            metrics.side,
          )
        : 0;

    return {
      pnl: toFiniteNumber(pnl, 0),
      spotPrice: scenarioVariance,
      x: (index / Math.max(moves.length - 1, 1)) * width,
    };
  });
  const minPnl = Math.min(...points.map((point) => point.pnl));
  const maxPnl = Math.max(...points.map((point) => point.pnl));
  const range = Math.max(maxPnl - minPnl, 1);
  const currentPoint = points[Math.floor(points.length / 2)];

  return {
    currentX: width / 2,
    currentY: toFiniteNumber(height - (((currentPoint?.pnl ?? 0) - minPnl) / range) * height, height / 2),
    path: points
      .map((point, index) => {
        const y = toFiniteNumber(height - ((point.pnl - minPnl) / range) * height, height / 2);
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" "),
    zeroY: toFiniteNumber(height - (-minPnl / range) * height, height / 2),
  };
}

export function PositionShapeSparkline({
  className,
  compact = false,
  interactive = false,
  metrics,
}: {
  className?: string;
  compact?: boolean;
  interactive?: boolean;
  metrics: ConvexExposureMetrics;
}) {
  const width = compact ? 112 : 180;
  const height = compact ? 36 : 72;
  const { currentX, currentY, path, zeroY } = buildPath(metrics, width, height);
  const stroke = metrics.side === "buy" ? "#60A5FA" : "#F59E0B";
  const displayMarkPrice = toFiniteNumber(metrics.markPrice, 0);

  return (
    <div className={cn("group relative space-y-1", className)} tabIndex={interactive ? 0 : -1}>
      <svg
        aria-label="Position payoff shape"
        className={cn("w-full", compact && "drop-shadow-[0_0_8px_rgba(96,165,250,0.16)]")}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line stroke="#1F2937" strokeDasharray="3 4" x1="0" x2={width} y1={zeroY} y2={zeroY} />
        <path d={path} fill="none" stroke={stroke} strokeWidth={compact ? 1.9 : 2.2} />
        <line
          stroke="#64748B"
          strokeDasharray="3 3"
          x1={currentX}
          x2={currentX}
          y1="0"
          y2={height}
        />
        <circle cx={currentX} cy={currentY} fill="#E5E7EB" r={compact ? 2.2 : 2.5} />
      </svg>
      {compact ? null : (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
          <span className="text-[#6B7280]">{formatVolPercentFromVariance(displayMarkPrice * 0.92)}</span>
          <span className="text-[#9CA3AF]">Vol {formatVolPercentFromVariance(displayMarkPrice)}</span>
          <span className="text-[#6B7280]">{formatVolPercentFromVariance(displayMarkPrice * 1.08)}</span>
        </div>
      )}

      {compact && interactive ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-48 rounded-sm border border-[#1B2430] bg-[#0E141C]/95 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.4)] group-hover:block group-focus-visible:block">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
            <span className="text-[#6B7280]">P&amp;L vs Vol</span>
            <span className="text-[#9CA3AF]">
              {metrics.side === "buy" ? "Long Volatility" : "Short Volatility"}
            </span>
          </div>
          <PositionShapeSparkline metrics={metrics} />
        </div>
      ) : null}
    </div>
  );
}
