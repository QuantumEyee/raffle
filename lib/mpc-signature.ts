import { MpcSignatureResponse } from "./types";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert MPC signer response to standard 65-byte EVM signature hex.
 *
 * MPC returns:
 *   big_r.affine_point: 33-byte compressed SEC1 point (02/03 prefix + 32 bytes x)
 *   s.scalar: 32-byte scalar
 *   recovery_id: 0 or 1
 *
 * Contract expects: r(32) || s(32) || v(1) where v = recovery_id + 27
 *
 * Reference: tests/src/env.rs:243-262 (pre_set_sign_message_signature)
 */
export function convertMpcSignature(mpcResponse: MpcSignatureResponse): string {
  const bigRBytes = hexToBytes(mpcResponse.big_r.affine_point);
  // Skip 02/03 prefix, take 32 bytes x-coordinate as r
  const rBytes = bigRBytes.slice(1, 33);

  const sBytes = hexToBytes(mpcResponse.s.scalar);

  // v = recovery_id + 27 (legacy Ethereum format)
  const v = mpcResponse.recovery_id + 27;

  const signature = new Uint8Array(65);
  signature.set(rBytes, 0);
  signature.set(sBytes, 32);
  signature[64] = v;

  return bytesToHex(signature);
}
