import { getConvexPnlUsd } from "@/lib/convex-perp";
import type { ConvexExposureMetrics } from "@/lib/trading.types";
import { cn } from "@/lib/cn";

function formatCompactPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildPath(metrics: ConvexExposureMetrics, width: number, height: number) {
  const moves = [-0.08, -0.05, -0.025, 0, 0.025, 0.05, 0.08];
  const points = moves.map((move, index) => {
    const spotPrice = metrics.markPrice * (1 + move);
    const pnl = getConvexPnlUsd(
      metrics.convexNotionalUsd,
      metrics.entryReferencePrice,
      spotPrice,
      metrics.side,
    );

    return {
      pnl,
      spotPrice,
      x: (index / Math.max(moves.length - 1, 1)) * width,
    };
  });
  const minPnl = Math.min(...points.map((point) => point.pnl));
  const maxPnl = Math.max(...points.map((point) => point.pnl));
  const range = Math.max(maxPnl - minPnl, 1);
  const currentPoint = points[Math.floor(points.length / 2)];

  return {
    currentX: width / 2,
    currentY: height - (((currentPoint?.pnl ?? 0) - minPnl) / range) * height,
    path: points
      .map((point, index) => {
        const y = height - ((point.pnl - minPnl) / range) * height;
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" "),
    zeroY: height - (-minPnl / range) * height,
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
          <span className="text-[#6B7280]">{formatCompactPrice(metrics.markPrice * 0.92)}</span>
          <span className="text-[#9CA3AF]">Spot {formatCompactPrice(metrics.markPrice)}</span>
          <span className="text-[#6B7280]">{formatCompactPrice(metrics.markPrice * 1.08)}</span>
        </div>
      )}

      {compact && interactive ? (
        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-48 rounded-sm border border-[#1B2430] bg-[#0E141C]/95 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.4)] group-hover:block group-focus-visible:block">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
            <span className="text-[#6B7280]">P&amp;L vs BTC</span>
            <span className="text-[#9CA3AF]">
              {metrics.side === "buy" ? "Long Convexity" : "Short Convexity"}
            </span>
          </div>
          <PositionShapeSparkline metrics={metrics} />
        </div>
      ) : null}
    </div>
  );
}
