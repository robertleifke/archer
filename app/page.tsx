import { getBtcSquaredPerpSnapshot } from "@/lib/btc-squared-market";
import { TradingTerminal } from "@/ui/trading-terminal/TradingTerminal";

export default async function Home() {
  const initialBtcSnapshot = await getBtcSquaredPerpSnapshot().catch(() => null);

  return <TradingTerminal initialBtcSnapshot={initialBtcSnapshot} />;
}
