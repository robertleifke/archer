import type { ConvexScenario } from "@/lib/trading.types";
import { cn } from "@/lib/cn";

function formatUsd(value: number, digits = 0) {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}

export function ScenarioPnLRows({
  scenarios,
}: {
  scenarios: ConvexScenario[];
}) {
  return (
    <div className="rounded-sm border border-[#1B2430] bg-[#0E141C]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] border-[#1B2430] border-b px-2 py-1 text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">
        <span>Scenario P&amp;L</span>
        <span>USDC</span>
      </div>
      {scenarios.map((scenario) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] px-2 py-1 text-[11px]"
          key={scenario.changeLabel}
        >
          <span className="text-[#9CA3AF]">{scenario.changeLabel}</span>
          <span className={cn("font-medium", scenario.pnlUsd >= 0 ? "text-[#8CC9A3]" : "text-[#F0A0A0]")}>
            {formatUsd(scenario.pnlUsd)}
          </span>
        </div>
      ))}
    </div>
  );
}
