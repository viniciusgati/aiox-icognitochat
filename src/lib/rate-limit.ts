interface RateEntry {
  failures: number
  windowStart: number
}

export class RateLimiter {
  private store = new Map<string, RateEntry>()

  /** Verifica se o IP está dentro do limite. Retorna `allowed` e `retryAfter` em segundos. */
  check(ip: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
    const now = Date.now()
    const entry = this.store.get(ip)

    if (!entry || now - entry.windowStart > windowMs) {
      this.store.set(ip, { failures: 0, windowStart: now })
      return { allowed: true, retryAfter: 0 }
    }

    if (entry.failures >= limit) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000)
      return { allowed: false, retryAfter }
    }

    return { allowed: true, retryAfter: 0 }
  }

  /** Registra uma tentativa com falha para o IP. */
  recordFailure(ip: string): void {
    const entry = this.store.get(ip)
    if (entry) entry.failures++
  }

  /** Reseta o contador do IP após login bem-sucedido. */
  onSuccess(ip: string): void {
    this.store.delete(ip)
  }

  /** Remove entradas expiradas para evitar memory leak. Chamar periodicamente. */
  cleanup(windowMs: number): void {
    const now = Date.now()
    this.store.forEach((entry, ip) => {
      if (now - entry.windowStart > windowMs) {
        this.store.delete(ip)
      }
    })
  }
}
