/**
 * Reconstruct raffle winners from PrizesDrawn event data.
 *
 * Replicates the on-chain select_winners algorithm:
 *   sha256(seed || rank_u32_le) -> first 8 bytes as u64 LE -> % available.length
 *
 * Reference: contracts/raffle/src/api/raffle.rs (select_winners)
 *            tests/js/reconstruct_winners.js
 */

import type { PrizesDrawnEvent } from "./types";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function u32ToLEBytes(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = n & 0xff;
  buf[1] = (n >> 8) & 0xff;
  buf[2] = (n >> 16) & 0xff;
  buf[3] = (n >> 24) & 0xff;
  return buf;
}

function readU64LE(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
  return new Uint8Array(hash);
}

async function selectWinners(
  participants: string[],
  alreadyWon: Set<string>,
  count: number,
  seedBytes: Uint8Array
): Promise<string[]> {
  const available = participants.filter((p) => !alreadyWon.has(p));
  const winners: string[] = [];

  for (let rank = 0; rank < count; rank++) {
    const rankBytes = u32ToLEBytes(rank);
    const hashInput = new Uint8Array(seedBytes.length + 4);
    hashInput.set(seedBytes, 0);
    hashInput.set(rankBytes, seedBytes.length);

    const hash = await sha256(hashInput);
    const randomU64 = readU64LE(hash);
    const index = Number(randomU64 % BigInt(available.length));

    const winner = available.splice(index, 1)[0];
    winners.push(winner);
  }

  return winners;
}

export interface VerificationResult {
  passed: boolean;
  rounds: RoundVerification[];
}

export interface RoundVerification {
  categoryName: string;
  seed: string;
  passed: boolean;
  expected: string[];
  actual: string[];
}

/**
 * Verify draw results by reconstructing winners from PrizesDrawn events.
 *
 * @param participants - Full participant list from get_raffle
 * @param events - PrizesDrawn events from transaction logs (in order)
 * @param priorWinners - Winners from prior draw rounds (empty for first draw)
 */
export async function verifyDrawResults(
  participants: string[],
  events: PrizesDrawnEvent[],
  priorWinners: string[] = []
): Promise<VerificationResult> {
  const allWon = new Set<string>(priorWinners);
  const rounds: RoundVerification[] = [];

  for (const event of events) {
    const seedBytes = hexToBytes(event.seed);
    const reconstructed = await selectWinners(
      participants,
      allWon,
      event.winners.length,
      seedBytes
    );

    // Compare
    const passed =
      reconstructed.length === event.winners.length &&
      reconstructed.every(
        (w, i) => w === event.winners[i]
      );

    rounds.push({
      categoryName: event.category_name,
      seed: event.seed,
      passed,
      expected: reconstructed,
      actual: event.winners,
    });

    // Accumulate winners for next round
    for (const w of event.winners) {
      allWon.add(w);
    }
  }

  return {
    passed: rounds.every((r) => r.passed),
    rounds,
  };
}
