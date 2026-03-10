const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T | null;
}

interface RandomRecord {
  id: number;
  requestId: string;
  status: number;
  failMsg: string | null;
  txHash: string | null;
  requestData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/add-random-record
 * Submit a randomness request to the data server.
 */
export async function addRandomRecord(
  requestId: string,
  requestData: { user_payload: string; user_signature: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/add-random-record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, requestData }),
  });

  const json: ApiResponse<{ requestId: string }> = await res.json();
  if (json.code !== 0) {
    throw new Error(`addRandomRecord failed: ${json.msg}`);
  }
}

/**
 * GET /api/random-record/:requestId
 * Poll every 2 seconds until txHash or failMsg is available.
 * Returns { txHash } on success or { failMsg } on failure.
 */
export async function pollRandomRecord(
  requestId: string,
  signal?: AbortSignal
): Promise<{ txHash: string } | { failMsg: string }> {
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Polling aborted", "AbortError");
    }

    const res = await fetch(`${API_BASE}/api/random-record/${requestId}`, {
      signal,
    });
    const json: ApiResponse<RandomRecord> = await res.json();

    if (json.code !== 0 || !json.data) {
      throw new Error(`pollRandomRecord failed: ${json.msg}`);
    }

    const { txHash, failMsg } = json.data;

    if (txHash) {
      return { txHash };
    }
    if (failMsg) {
      return { failMsg };
    }

    // Wait 2 seconds before next poll
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 2000);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Polling aborted", "AbortError"));
      }, { once: true });
    });
  }
}

/**
 * POST /api/random-record/:requestId
 * Update the record with txHash (used by Mock TEE flow).
 */
export async function updateRandomRecord(
  requestId: string,
  txHash: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/random-record/${requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  });

  const json: ApiResponse<RandomRecord> = await res.json();
  if (json.code !== 0) {
    throw new Error(`updateRandomRecord failed: ${json.msg}`);
  }
}
