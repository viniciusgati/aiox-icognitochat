'use client'

/**
 * wipeDevice — best-effort cleanup of all local session data.
 * Chain: socket disconnect → server logout → localStorage → sessionStorage → caches → redirect
 */
export async function wipeDevice(disconnectSocket?: () => void): Promise<void> {
  // 1. Disconnect socket if available
  disconnectSocket?.()

  // 2. Server-side logout (invalidate session cookie)
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Continue even if request fails
  }

  // 3. Clear all localStorage
  try {
    localStorage.clear()
  } catch {
    // Ignore — may fail in private mode
  }

  // 4. Clear sessionStorage
  try {
    sessionStorage.clear()
  } catch {
    // Ignore
  }

  // 5. Clear all Cache API caches
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Ignore
  }

  // 6. Redirect to home (replace so back button doesn't restore chat)
  window.location.replace('/')
}
