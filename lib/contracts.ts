import {
  viewCall,
  callMethod,
  getUserAccount,
  getTeeAccount,
  YOCTO_ONE,
  NEAR_DEPOSIT,
  type CallResult,
} from "./near";
import type {
  UserId,
  AccountInfo,
  PrizeCategoryInput,
  RaffleView,
  RandomnessRequest,
  MpcSignatureResponse,
  PrizesDrawnEvent,
} from "./types";

const RANDOMNESS_CONTRACT =
  process.env.NEXT_PUBLIC_RANDOMNESS_CONTRACT || "randomness-infura.testnet";
const RAFFLE_CONTRACT =
  process.env.NEXT_PUBLIC_RAFFLE_CONTRACT || "raffle-core.testnet";

// --- Raffle Contract ---

export async function createRaffle(
  name: string,
  participants: string[],
  categories: PrizeCategoryInput[]
): Promise<CallResult> {
  const account = getUserAccount();
  return callMethod(account, RAFFLE_CONTRACT, "create_raffle", {
    name,
    participants,
    categories,
  }, NEAR_DEPOSIT);
}

export async function getRaffle(raffleId: number): Promise<RaffleView | null> {
  return viewCall<RaffleView | null>(RAFFLE_CONTRACT, "get_raffle", {
    raffle_id: raffleId,
  });
}

export async function getRaffleCount(): Promise<number> {
  return viewCall<number>(RAFFLE_CONTRACT, "get_raffle_count");
}

// --- Randomness Contract ---

export async function deriveEvmUserId(accountId: string): Promise<UserId> {
  return viewCall<UserId>(RANDOMNESS_CONTRACT, "derive_evm_user_id", {
    account_id: accountId,
  });
}

export async function getAccount(userId: UserId): Promise<AccountInfo | null> {
  return viewCall<AccountInfo | null>(RANDOMNESS_CONTRACT, "get_account", {
    user_id: userId,
  });
}

/**
 * Call sign_message on the randomness contract.
 * This triggers MPC signing via v1.signer-prod.testnet.
 *
 * Returns the MPC signature response from the transaction result.
 * The contract applies eip191_hash_message(message) before sending to MPC.
 */
export async function signMessage(
  message: string
): Promise<{ mpcResponse: MpcSignatureResponse; txHash: string }> {
  const account = getUserAccount();
  const res = await callMethod(
    account,
    RANDOMNESS_CONTRACT,
    "sign_message",
    { message },
    YOCTO_ONE // 1 yoctoNEAR required
  );

  // The result is the MPC signer's response, forwarded through the Promise chain
  const mpcResponse = res.result as MpcSignatureResponse;
  if (!mpcResponse?.big_r?.affine_point || !mpcResponse?.s?.scalar) {
    throw new Error(
      `Unexpected MPC response format: ${JSON.stringify(res.result)}`
    );
  }

  return { mpcResponse, txHash: res.txHash };
}

/**
 * Call generate_random_number from the TEE worker account.
 * This triggers the callback to raffle.on_randomness_generated.
 */
export async function generateRandomNumber(
  request: RandomnessRequest
): Promise<CallResult> {
  const account = getTeeAccount();
  return callMethod(
    account,
    RANDOMNESS_CONTRACT,
    "generate_random_number",
    { randomness_request: request },
    "0"
  );
}

/**
 * Parse raffle_id from RaffleCreated event in transaction logs.
 * Event format: EVENT_JSON:{"standard":"raffle","version":"1.0.0","event":"raffle_created","data":{...}}
 */
export function parseRaffleIdFromLogs(logs: string[]): number | null {
  for (const log of logs) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    try {
      const event = JSON.parse(log.slice("EVENT_JSON:".length));
      if (event.event === "raffle_created" && event.data?.raffle_id != null) {
        return event.data.raffle_id;
      }
    } catch {
      // skip non-JSON logs
    }
  }
  return null;
}

/**
 * Extract PrizesDrawn events from transaction logs.
 * Each draw round emits one PrizesDrawn event per category drawn.
 * Event format: EVENT_JSON:{"standard":"raffle","version":"1.0.0","event":"prizes_drawn","data":{...}}
 */
export function parsePrizesDrawnEvents(logs: string[]): PrizesDrawnEvent[] {
  const events: PrizesDrawnEvent[] = [];
  for (const log of logs) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    try {
      const event = JSON.parse(log.slice("EVENT_JSON:".length));
      if (event.standard === "raffle" && event.event === "prizes_drawn" && event.data) {
        events.push({
          raffle_id: event.data.raffle_id,
          category_name: event.data.category_name,
          winners: event.data.winners,
          seed: event.data.seed,
        });
      }
    } catch {
      // skip non-JSON logs
    }
  }
  return events;
}
