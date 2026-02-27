import nacl from "tweetnacl";
import bs58 from "bs58";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign TEE payload locally with Ed25519 key.
 *
 * TEE signature format (from contracts/randomness_infura/src/api/randomness.rs:77-91):
 *   message = `${user_payload}|${user_signature}|${tee_payload}`
 *   signature = ed25519_sign(tee_private_key, message)
 *
 * NEAR ed25519 private key format: "ed25519:BASE58(seed32 + pubkey32)"
 * tweetnacl expects the full 64-byte secret key (seed + pubkey).
 */
export function signTeePayload(
  userPayloadJson: string,
  userSignatureHex: string,
  teeRandomSeed: string,
  teePrivateKeyStr: string
): { teePayload: string; teeSignature: string } {
  // Parse NEAR ed25519 key
  const base58Part = teePrivateKeyStr.replace("ed25519:", "");
  const keyBytes = bs58.decode(base58Part); // 64 bytes: seed(32) + pubkey(32)

  // Build TEE payload
  const teePayload = JSON.stringify({ random_seed: teeRandomSeed });

  // Build message to sign: user_payload|user_signature|tee_payload
  const messageToSign = `${userPayloadJson}|${userSignatureHex}|${teePayload}`;

  // Sign with Ed25519
  const signature = nacl.sign.detached(
    new TextEncoder().encode(messageToSign),
    keyBytes
  );

  return {
    teePayload,
    teeSignature: bytesToHex(signature), // 64 bytes = 128 hex chars
  };
}
