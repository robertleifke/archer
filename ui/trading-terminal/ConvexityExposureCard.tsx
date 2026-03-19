import type { ConvexExposureMetrics } from "@/lib/trading.types";
import { ScenarioPnLRows } from "@/ui/trading-terminal/ScenarioPnLRows";

function formatUsd(value: number, digits = 0) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}

function formatUnsignedUsd(value: number, digits = 0) {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-[#6B7280]">{label}</span>
      <span className="font-medium text-[#D1D5DB]">{value}</span>
    </div>
  );
}

export function ConvexityExposureCard({
  baseAsset,
  metrics,
}: {
  baseAsset: string;
  metrics: ConvexExposureMetrics;
}) {
  return (
    <div className="space-y-2 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
      <div className="flex items-center justify-between">
        <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Exposure Preview</div>
        <div className="rounded-full border border-[#1F3C55] bg-[#0E2233] px-2 py-0.5 text-[#93C5FD] text-[10px]">
          {metrics.side === "buy" ? "Long Gamma" : "Short Gamma"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <MetricRow label="Delta Equivalent" value={`${metrics.deltaEquivalentBtc.toFixed(2)} ${baseAsset}`} />
        <MetricRow label="Delta Notional" value={formatUnsignedUsd(metrics.deltaNotionalUsd)} />
        <MetricRow
          label="Gamma"
          value={`${metrics.gammaPer1PctMove >= 0 ? "+" : "-"}${Math.abs(metrics.gammaPer1PctMove).toFixed(3)} ${baseAsset} per 1%`}
        />
        <MetricRow label="Estimated Funding" value={formatUsd(metrics.estimatedFundingUsd8h)} />
        <MetricRow label="Break-even Move" value={`±${metrics.breakEvenMovePercent.toFixed(2)}%`} />
        <MetricRow label="Mark" value={metrics.markPrice.toFixed(2)} />
      </div>

      <ScenarioPnLRows scenarios={metrics.scenarioPnl} />
    </div>
  );
}
