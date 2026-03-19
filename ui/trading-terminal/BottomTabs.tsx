import { ChevronDown } from "lucide-react";
import type { ActivityTab, ActivityView } from "@/lib/trading.types";
import { cn } from "@/lib/cn";

export function BottomTabs({
  activityView,
  filter,
  footerLinks,
  selectedTab,
  tabs,
  onFilterClick,
  onTabSelect,
}: {
  activityView: ActivityView;
  filter: string;
  footerLinks: readonly { href: string; label: string }[];
  selectedTab: string;
  tabs: ActivityTab[];
  onFilterClick: () => void;
  onTabSelect: (tabId: string) => void;
}) {
  return (
    <section className="rounded-md border border-[#1B2430] bg-[#0F1720]">
      <div className="flex flex-col gap-2 border-[#1B2430] border-b px-3 py-1 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1B2430] bg-[#11161D] px-2 py-0.5 font-medium text-[#93C5FD] text-[10px]">
            <span className="size-1.5 rounded-full bg-[#3B82F6]" />
            Online
          </div>

          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                className={cn(
                  "rounded-sm px-2 py-1 font-medium text-[#6B7280] text-[11px] transition-colors hover:bg-[#11161D]",
                  selectedTab === tab.id && "bg-[#11161D] text-[#E5E7EB]",
                )}
                key={tab.id}
                onClick={() => onTabSelect(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="inline-flex items-center gap-1 self-start rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1 text-[#D1D5DB] text-[11px] lg:self-auto"
          onClick={onFilterClick}
          type="button"
        >
          Filter: {filter}
          <ChevronDown className="size-4 text-[#6B7280]" />
        </button>
      </div>

      <div className="min-h-[72px] px-3 py-2">
        <div
          className="grid gap-3 text-[#6B7280] text-[10px] uppercase tracking-[0.14em]"
          style={{ gridTemplateColumns: `repeat(${activityView.columns.length}, minmax(0, 1fr))` }}
        >
          {activityView.columns.map((column) => (
            <span className={column === "PnL" ? "text-right" : undefined} key={column}>
              {column}
            </span>
          ))}
        </div>

        <div className="mt-2.5 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          {activityView.rows.map((row, rowIndex) => (
            <div
              className="grid gap-3 text-sm"
              key={`${row.cells[0]}-${rowIndex}`}
              style={{ gridTemplateColumns: `repeat(${activityView.columns.length}, minmax(0, 1fr))` }}
            >
              {row.cells.map((cell, cellIndex) => (
                <span
                  className={cn(
                    "min-w-0 truncate text-[#D1D5DB]",
                    cellIndex === 0 && "font-medium text-[#E5E7EB]",
                    activityView.columns[cellIndex] === "PnL" && "text-right",
                    row.positiveCellIndexes?.includes(cellIndex) && "font-medium text-[#8CC9A3]",
                  )}
                  key={`${cell}-${cellIndex}`}
                >
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-[#1B2430] border-t px-3 py-1.5 text-[#6B7280] text-xs sm:flex-row sm:items-center sm:justify-end">
        {footerLinks.map((link) => (
          <a className="transition-colors hover:text-[#D1D5DB]" href={link.href} key={link.label}>
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
