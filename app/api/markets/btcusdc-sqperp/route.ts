import { getBtcSquaredPerpSnapshot } from "@/lib/btc-squared-market";

type Handler = () => Promise<Response>;

export const GET: Handler = async function GET() {
  try {
    return Response.json(await getBtcSquaredPerpSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BTC squared market error";
    console.error("BTC squared market route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
