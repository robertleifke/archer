import { cancelBtcConvexOrder } from "@/lib/matching-backend";

type Handler = (request: Request) => Promise<Response>;

type CancelOrderRequest = {
  nonce: string;
  ownerAddress: string;
};

function isCancelOrderRequest(payload: unknown): payload is CancelOrderRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const request = payload as Record<string, unknown>;

  return typeof request.nonce === "string" && request.nonce.length > 0 && typeof request.ownerAddress === "string" && request.ownerAddress.length > 0;
}

export const POST: Handler = async function POST(request) {
  try {
    const payload = (await request.json()) as unknown;

    if (!isCancelOrderRequest(payload)) {
      return Response.json(
        {
          error: "Invalid convex perp cancel payload",
        },
        { status: 400 },
      );
    }

    return Response.json(
      await cancelBtcConvexOrder({
        nonce: payload.nonce,
        ownerAddress: payload.ownerAddress,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown convex perp cancel error";
    console.error("BTC convex perp cancel route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
