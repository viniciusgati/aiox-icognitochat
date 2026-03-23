/**
 * ECDH key exchange utilities for per-session E2E encryption.
 * Each client generates an X25519 keypair once per session (in-memory only).
 * The room key (AES-256-GCM) is negotiated via ECDH and never sent in plaintext.
 */

// ─── Keypair ──────────────────────────────────────────────────────────────────

/** Generate an X25519 keypair for this session. Private key is non-extractable. */
export async function generateSessionKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'X25519' }, false, ['deriveKey'])
}

// ─── Public key serialization ─────────────────────────────────────────────────

/** Export a public key to base64 for transport over Socket.IO. */
export async function exportPubKey(pubKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', pubKey)
  return arrayBufferToBase64(raw)
}

/** Import a base64 public key received from a peer. */
export async function importPubKey(b64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(b64)
  return crypto.subtle.importKey('raw', raw, { name: 'X25519' }, true, [])
}

// ─── ECDH shared key ──────────────────────────────────────────────────────────

/** Derive a shared AES-256-GCM key from our private key and a peer's public key. */
export async function deriveSharedKey(privKey: CryptoKey, peerPubKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'X25519', public: peerPubKey },
    privKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ─── Room key ────────────────────────────────────────────────────────────────

/** Generate a fresh random AES-256-GCM room key. Extractable so it can be distributed. */
export async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/** Export a room key to raw bytes for encryption + distribution to a peer. */
export async function exportRoomKey(roomKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', roomKey)
}

/** Import raw room key bytes (after decrypting the envelope) into a CryptoKey. */
export async function importRoomKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

// ─── Room key envelope (ECDH-wrapped) ────────────────────────────────────────

/** Encrypt raw room key bytes with a shared ECDH key. Returns base64 strings for JSON transport. */
export async function encryptRoomKeyEnvelope(
  sharedKey: CryptoKey,
  roomKeyRaw: ArrayBuffer
): Promise<{ encryptedRoomKey: string; iv: string }> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, sharedKey, roomKeyRaw)
  return {
    encryptedRoomKey: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(ivBytes.buffer),
  }
}

/** Decrypt a room key envelope using the shared ECDH key. Returns the raw key bytes. */
export async function decryptRoomKeyEnvelope(
  sharedKey: CryptoKey,
  encryptedRoomKey: string,
  iv: string
): Promise<ArrayBuffer> {
  const ciphertextBuf = base64ToArrayBuffer(encryptedRoomKey)
  const ivBuf = base64ToArrayBuffer(iv)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, sharedKey, ciphertextBuf)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer
}
