import { ChevronDown, Info } from "lucide-react";
import type { DeliveryTerm } from "@/lib/trading.types";
import { cn } from "@/lib/cn";

function LabelValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[#6B7280]">{label}</span>
      <span
        className={cn(
          "font-medium text-[#D1D5DB]",
          value.startsWith("+$") && "text-[#8CC9A3]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TradePanel({
  baseAsset,
  allocation,
  contractDetails,
  contractLabel,
  markPrice,
  lastAction,
  orderType,
  positionOverview,
  quoteAsset,
  postOnly,
  settlementWallet,
  size,
  tradeSide,
  onAllocationChange,
  onOrderTypeChange,
  onPostOnlyToggle,
  onSideChange,
  onSizeChange,
  onSubmit,
}: {
  baseAsset: string;
  allocation: number;
  contractDetails: DeliveryTerm[];
  contractLabel: string;
  markPrice: string;
  lastAction: string;
  orderType: "Limit" | "Market" | "Stop";
  positionOverview: DeliveryTerm[];
  postOnly: boolean;
  quoteAsset: string;
  settlementWallet: string;
  size: string;
  tradeSide: "buy" | "sell";
  onAllocationChange: (value: number) => void;
  onOrderTypeChange: (type: "Limit" | "Market" | "Stop") => void;
  onPostOnlyToggle: () => void;
  onSideChange: (side: "buy" | "sell") => void;
  onSizeChange: (value: string) => void;
  onSubmit: (side: "buy" | "sell") => void;
}) {
  return (
    <section className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-md border border-[#1B2430] bg-[#0F1720] xl:min-h-0">
      <div className="space-y-2 overflow-y-auto p-2.5 text-[11px]">
        <div className="grid grid-cols-3 gap-1 rounded-sm bg-[#11161D] p-1">
          {["Market", "Limit", "Stop"].map((tab) => (
            <button
              className={cn(
                "rounded-sm px-2 py-1.5 font-medium text-[11px] transition-colors",
                orderType === tab ? "bg-[#151B23] text-[#D1D5DB]" : "text-[#6B7280]",
              )}
              key={tab}
              onClick={() => onOrderTypeChange(tab as "Limit" | "Market" | "Stop")}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            className={cn(
              "rounded-sm px-3 py-2 text-left",
              tradeSide === "buy" ? "bg-[#123524]" : "bg-[#101820]",
            )}
            onClick={() => onSideChange("buy")}
            type="button"
          >
            <span className="block font-semibold text-[#D1FAE5] text-sm">Buy {baseAsset}</span>
            <span className="mt-0.5 block text-[#8CC9A3] text-[11px]">
              Long {baseAsset} / Short {quoteAsset}
            </span>
          </button>
          <button
            className={cn(
              "rounded-sm px-3 py-2 text-left",
              tradeSide === "sell" ? "bg-[#4D1717]" : "bg-[#101820]",
            )}
            onClick={() => onSideChange("sell")}
            type="button"
          >
            <span className="block font-semibold text-[#FDE2E2] text-sm">Sell {baseAsset}</span>
            <span className="mt-0.5 block text-[#D59C9C] text-[11px]">
              Short {baseAsset} / Long {quoteAsset}
            </span>
          </button>
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <LabelValueRow label="Contract" value={contractLabel} />
          <LabelValueRow label="Available to Deliver" value={`250,000 ${quoteAsset}C`} />
          <LabelValueRow label="Settlement Wallet" value={settlementWallet} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]" htmlFor="trade-size">
            Size
          </label>
          <div className="flex items-center overflow-hidden rounded-sm border border-[#1B2430] bg-[#11161D]">
            <input
              className="h-10 flex-1 bg-transparent px-3 text-[#D1D5DB] text-sm outline-none placeholder:text-[#6B7280]"
              id="trade-size"
              onChange={(event) => onSizeChange(event.target.value.replace(/[^\d.]/g, ""))}
              placeholder="1.00"
              value={size}
            />
            <button
              className="flex h-10 items-center gap-1 border-[#1B2430] border-l px-3 text-[#D1D5DB] text-sm"
              type="button"
            >
              {baseAsset}
              <ChevronDown className="size-4 text-[#6B7280]" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="h-1.5 flex-1 accent-[#3B82F6]"
              max="100"
              min="0"
              onChange={(event) => onAllocationChange(Number(event.target.value))}
              type="range"
              value={allocation}
            />
            <div className="rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1 text-[#D1D5DB] text-[11px]">
              {allocation} %
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <button
            className="flex w-full items-center justify-between rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1.5"
            onClick={onPostOnlyToggle}
            type="button"
          >
            <span className="text-[#D1D5DB]">Post Only</span>
            <span className={cn("text-[#6B7280]", postOnly && "text-[#BFDBFE]")}>
              {postOnly ? "On" : "Off"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            className="flex h-9 items-center justify-center rounded-sm border border-[#14532D] bg-[#123524] font-medium text-[#86EFAC] text-sm transition-colors hover:bg-[#17412c]"
            onClick={() => onSubmit("buy")}
            type="button"
          >
            Buy {baseAsset}
          </button>
          <button
            className="flex h-9 items-center justify-center rounded-sm border border-[#7F1D1D] bg-[#4D1717] font-medium text-[#D59C9C] text-sm transition-colors hover:bg-[#5b1b1b]"
            onClick={() => onSubmit("sell")}
            type="button"
          >
            Sell {baseAsset}
          </button>
        </div>

        <div className="rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1.5 text-[#9CA3AF] text-[11px]">
          {lastAction}
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Position Summary</div>
          {positionOverview.map((item) => (
            <LabelValueRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Order Economics</div>
          <LabelValueRow label="Order Value" value={`~${quoteAsset} ${markPrice}`} />
          <LabelValueRow label="Initial Margin" value="$4,012" />
          <LabelValueRow label="Fees" value="0.0200% / 0.0100%" />
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-[#6B7280]">
              Slippage
              <Info className="size-3" />
            </span>
            <span className="font-medium text-[#D1D5DB]">Est: 0.01% / Max: 0.25%</span>
          </div>
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Delivery Terms</div>
          {contractDetails.map((item) => (
            <LabelValueRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
