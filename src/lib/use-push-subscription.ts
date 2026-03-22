'use client'

import { useEffect, useState, useCallback } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied' | 'loading'

function isBrowserSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

async function saveSubscription(sub: PushSubscription): Promise<string | null> {
  const json = sub.toJSON()
  const keys = json.keys as { p256dh: string; auth: string }
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return data.error ?? `Erro ${res.status} ao salvar subscription`
    }
    return null
  } catch {
    return 'Erro de rede ao salvar subscription'
  }
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isBrowserSupported()) {
      setStatus('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'granted') {
      // Check if we actually have a subscription — if not, don't lie about being "granted"
      navigator.serviceWorker.ready
        .then(async (reg) => {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            // Re-sync subscription with server (handles server data loss)
            const err = await saveSubscription(sub)
            if (err) setError(err)
            setStatus('granted')
          } else {
            // Permission granted but no subscription yet — needs user action
            setStatus('default')
          }
        })
        .catch(() => setStatus('default'))
    } else if (perm === 'denied') {
      setStatus('denied')
    } else {
      setStatus('default')
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<PushStatus> => {
    setError(null)

    if (!isBrowserSupported()) {
      setStatus('unsupported')
      return 'unsupported'
    }

    if (!VAPID_PUBLIC_KEY) {
      setError('NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada — configure nas variáveis de ambiente e faça redeploy.')
      setStatus('default')
      return 'default'
    }

    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as PushStatus)
        return permission as PushStatus
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const saveError = await saveSubscription(sub)
      if (saveError) {
        setError(saveError)
        // Still mark as granted in browser — permission was given
        setStatus('granted')
        return 'granted'
      }

      setStatus('granted')
      return 'granted'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao ativar push'
      setError(msg)
      setStatus('default')
      return 'default'
    }
  }, [])

  return { status, error, requestPermission }
}
