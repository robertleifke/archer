import { prepareBtcConvexOrder } from "@/lib/convex-order";

type Handler = (request: Request) => Promise<Response>;

type PrepareOrderRequest = {
  markPrice: string;
  ownerAddress: string;
  side: "buy" | "sell";
  sizeBtc: string;
};

function isPrepareOrderRequest(payload: unknown): payload is PrepareOrderRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const request = payload as Record<string, unknown>;

  return (
    typeof request.markPrice === "string" &&
    typeof request.ownerAddress === "string" &&
    typeof request.sizeBtc === "string" &&
    (request.side === "buy" || request.side === "sell")
  );
}

export const POST: Handler = async function POST(request) {
  try {
    const payload = (await request.json()) as unknown;

    if (!isPrepareOrderRequest(payload)) {
      return Response.json(
        {
          error: "Invalid convex perp order preparation payload",
        },
        { status: 400 },
      );
    }

    return Response.json(await prepareBtcConvexOrder(payload));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown convex perp order preparation error";
    console.error("BTC convex perp order preparation route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
