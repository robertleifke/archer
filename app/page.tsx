import { getBtcSquaredPerpSnapshot } from "@/lib/btc-squared-market";
import { getNgnSquaredPerpSnapshot } from "@/lib/ngn-squared-market";
import { TradingTerminal } from "@/ui/trading-terminal/TradingTerminal";

export default async function Home() {
  const [initialBtcSnapshot, initialNgnSnapshot] = await Promise.all([
    getBtcSquaredPerpSnapshot().catch(() => null),
    getNgnSquaredPerpSnapshot().catch(() => null),
  ]);

  return <TradingTerminal initialBtcSnapshot={initialBtcSnapshot} initialNgnSnapshot={initialNgnSnapshot} />;
}
