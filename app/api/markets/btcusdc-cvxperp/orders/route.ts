import { submitBtcConvexOrder } from "@/lib/matching-backend";
import type { MatchingBackendCreateOrderRequest } from "@/lib/trading.types";

type Handler = (request: Request) => Promise<Response>;

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0;
}

function isMatchingBackendCreateOrderRequest(
  payload: unknown,
): payload is MatchingBackendCreateOrderRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const order = payload as Record<string, unknown>;
  const actionJson =
    order.action_json && typeof order.action_json === "object"
      ? (order.action_json as Record<string, unknown>)
      : null;

  return (
    actionJson !== null &&
    isNonEmptyString(actionJson.data) &&
    isNonEmptyString(actionJson.expiry) &&
    isNonEmptyString(actionJson.module) &&
    isNonEmptyString(actionJson.nonce) &&
    isNonEmptyString(actionJson.owner) &&
    isNonEmptyString(actionJson.signer) &&
    isNonEmptyString(actionJson.subaccount_id) &&
    isNonEmptyString(order.asset_address) &&
    isNonEmptyString(order.desired_amount) &&
    typeof order.expiry === "number" &&
    Number.isFinite(order.expiry) &&
    isNonEmptyString(order.filled_amount) &&
    isNonEmptyString(order.limit_price) &&
    isNonEmptyString(order.nonce) &&
    isNonEmptyString(order.order_id) &&
    isNonEmptyString(order.owner_address) &&
    isNonEmptyString(order.recipient_id) &&
    (order.side === "buy" || order.side === "sell") &&
    isNonEmptyString(order.signature) &&
    isNonEmptyString(order.signer_address) &&
    isNonEmptyString(order.sub_id) &&
    isNonEmptyString(order.subaccount_id) &&
    isNonEmptyString(order.worst_fee)
  );
}

export const POST: Handler = async function POST(request) {
  try {
    const payload = (await request.json()) as unknown;

    if (!isMatchingBackendCreateOrderRequest(payload)) {
      return Response.json(
        {
          error: "Invalid matching backend order payload",
        },
        { status: 400 },
      );
    }

    return Response.json(await submitBtcConvexOrder(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown convex perp order error";
    console.error("BTC convex perp order route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
