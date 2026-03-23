const ENC = new TextEncoder()
const DEC = new TextDecoder()

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

export async function encryptBinary(
  key: CryptoKey,
  data: ArrayBuffer
): Promise<{ ciphertext: ArrayBuffer; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return {
    ciphertext,
    iv: btoa(Array.from(iv, (b) => String.fromCharCode(b)).join('')),
  }
}

export async function decryptBinary(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: string
): Promise<ArrayBuffer> {
  const ivbuf = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivbuf }, key, ciphertext)
}
