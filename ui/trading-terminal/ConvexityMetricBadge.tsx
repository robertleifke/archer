import { Info } from "lucide-react";

export function ConvexityMetricBadge({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip?: string;
  value: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[#1B2430] bg-[#11161D]/90 px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
      title={tooltip}
    >
      <span className="text-[#9CA3AF]">{label}</span>
      {tooltip ? <Info className="size-3 text-[#6B7280]" /> : null}
      <span className="text-[#E5E7EB]">{value}</span>
    </span>
  );
}
