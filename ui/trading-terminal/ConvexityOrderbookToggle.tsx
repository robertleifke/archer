import type { OrderBookDisplayMode } from "@/lib/trading.types";
import { cn } from "@/lib/cn";

function getDisplayLabel(mode: OrderBookDisplayMode) {
  if (mode === "delta") {
    return "Delta Eq";
  }

  if (mode === "convex") {
    return "Convexity";
  }

  return "Price";
}

export function ConvexityOrderbookToggle({
  displayMode,
  onDisplayModeChange,
}: {
  displayMode: OrderBookDisplayMode;
  onDisplayModeChange: (mode: OrderBookDisplayMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-1">
      {(["price", "delta", "convex"] as const).map((mode) => (
        <button
          className={cn(
            "whitespace-nowrap rounded-sm px-2 py-1 text-[10px]",
            displayMode === mode ? "bg-[#172554]/50 text-[#BFDBFE]" : "text-[#6B7280]",
          )}
          key={mode}
          onClick={() => onDisplayModeChange(mode)}
          type="button"
        >
          {getDisplayLabel(mode)}
        </button>
      ))}
    </div>
  );
}
