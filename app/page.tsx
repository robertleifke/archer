import { getBtcSquaredPerpSnapshot } from "@/lib/btc-squared-market";
import { getNgnPerpSnapshot } from "@/lib/ngn-perp-market";
import { TradingTerminal } from "@/ui/trading-terminal/TradingTerminal";

export default async function Home() {
  const [initialBtcSnapshot, initialNgnSnapshot] = await Promise.all([
    getBtcSquaredPerpSnapshot().catch(() => null),
    getNgnPerpSnapshot().catch(() => null),
  ]);

  return <TradingTerminal initialBtcSnapshot={initialBtcSnapshot} initialNgnSnapshot={initialNgnSnapshot} />;
}
