'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
            router.push('/')
          })
        }
      })
      .catch(() => {
        // Erro de rede: manter usuário na página (fail-open intencional)
      })
  }, [router])

  return null
}
