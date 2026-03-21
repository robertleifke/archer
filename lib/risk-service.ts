import "server-only";

import type { BtcConvexRiskSnapshot } from "@/lib/trading.types";

const DEFAULT_RISK_SERVICE_URL = "http://127.0.0.1:8083";

type FetchErrorWithCause = Error & {
  cause?: {
    code?: string;
  };
};

function getRiskServiceUrl() {
  return process.env.RISK_SERVICE_URL?.trim() || DEFAULT_RISK_SERVICE_URL;
}

function getRiskServiceEndpoint(path: string, searchParams?: URLSearchParams) {
  const url = new URL(path, getRiskServiceUrl());

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}

function isRiskServiceUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as FetchErrorWithCause).cause;
  return (
    cause?.code === "ECONNREFUSED" ||
    cause?.code === "ENOTFOUND" ||
    cause?.code === "EHOSTUNREACH"
  );
}

export async function getBtcConvexRiskSnapshot({
  ownerAddress,
  side,
  sizeBtc,
}: {
  ownerAddress: string;
  side: "buy" | "sell";
  sizeBtc: string;
}): Promise<BtcConvexRiskSnapshot> {
  let response: Response;

  try {
    response = await fetch(
      getRiskServiceEndpoint(
        "/v1/btcusdc-cvxperp/risk",
        new URLSearchParams({
          ownerAddress,
          side,
          sizeBtc,
        }),
      ),
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
      },
    );
  } catch (error) {
    if (isRiskServiceUnavailableError(error)) {
      throw new Error("Risk service is unavailable");
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Risk service request failed with status ${response.status}`);
  }

  return (await response.json()) as BtcConvexRiskSnapshot;
}
