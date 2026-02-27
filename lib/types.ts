// Contract type definitions matching the Rust structs

// --- Raffle Contract Types ---

export interface PrizeCategoryInput {
  name: string;
  count: number;
}

export interface PrizeCategory {
  name: string;
  count: number;
  winners: string[];
}

export interface RaffleView {
  id: number;
  name: string;
  creator: string;
  participants: string[];
  categories: PrizeCategory[];
  all_winners: string[];
}

export type DrawMode =
  | "All"
  | { Category: { category_index: number; count: number } };

export interface DrawMessage {
  raffle_id: number;
  mode: DrawMode;
}

// --- Randomness Contract Types ---

export type UserId = { Evm: string };

export interface AccountInfo {
  tokens: Record<string, string>;
  nonce: number;
}

export interface Callback {
  contract_id: string;
  message: string;
  token_transfer?: {
    token_id: string;
    amount: string;
    memo?: string;
  };
}

export interface UserPayload {
  user_id: UserId;
  nonce: number;
  deadline: string; // MUST be string — contract uses DisplayFromStr
  fee_token: string;
  random_seed: string;
  callback?: Callback;
}

export interface TeePayload {
  random_seed: string;
}

export interface RandomnessRequest {
  user_payload: string;
  user_signature: string;
  tee_payload: string;
  tee_signature: string;
}

// --- MPC Signer Response ---

export interface MpcSignatureResponse {
  big_r: { affine_point: string };
  s: { scalar: string };
  recovery_id: number;
}

// --- PrizesDrawn Event ---

export interface PrizesDrawnEvent {
  raffle_id: number;
  category_name: string;
  winners: string[];
  seed: string; // hex
}

// --- UI Types ---

export interface LogEntry {
  timestamp: number;
  action: string;
  status: "success" | "error" | "pending";
  txHash?: string;
  detail?: string;
}
