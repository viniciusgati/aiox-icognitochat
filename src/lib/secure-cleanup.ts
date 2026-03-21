/**
 * Best-effort memory cleanup utilities for sensitive data.
 *
 * Limitation: JavaScript does not allow direct heap access, so these
 * functions reduce the window of exposure but cannot guarantee zeroed memory.
 */

/** Nullify the CryptoKey reference so GC can collect it sooner. */
export function clearCryptoKey(keyRef: { current: CryptoKey | null }): void {
  keyRef.current = null
}

/** Overwrite message content strings before clearing the array (best-effort). */
export function zeroizeMessages(messages: Array<{ content: string }>): void {
  for (let i = 0; i < messages.length; i++) {
    messages[i].content = ''
  }
}
