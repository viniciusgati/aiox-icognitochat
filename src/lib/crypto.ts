const ENC = new TextEncoder()
const DEC = new TextDecoder()

export async function deriveRoomKey(roomId: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENC.encode(roomId),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENC.encode('icognito-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherbuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENC.encode(plaintext)
  )
  return {
    ciphertext: btoa(Array.from(new Uint8Array(cipherbuf), (b) => String.fromCharCode(b)).join('')),
    iv: btoa(Array.from(iv, (b) => String.fromCharCode(b)).join('')),
  }
}

export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  const cipherbuf = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const ivbuf = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
  const plainbuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivbuf },
    key,
    cipherbuf
  )
  return DEC.decode(plainbuf)
}
