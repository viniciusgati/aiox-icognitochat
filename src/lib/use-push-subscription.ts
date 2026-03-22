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

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const keys = json.keys as { p256dh: string; auth: string }
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }),
  }).catch(() => {})
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading')

  // On mount: read current permission state without prompting
  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'granted') {
      setStatus('granted')
      // Silently re-register existing subscription in case server lost it
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) saveSubscription(sub)
        })
      ).catch(() => {})
    } else if (perm === 'denied') {
      setStatus('denied')
    } else {
      setStatus('default')
    }
  }, [])

  // User-triggered: ask permission and subscribe
  const requestPermission = useCallback(async (): Promise<PushStatus> => {
    if (!isPushSupported()) return 'unsupported'
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
      await saveSubscription(sub)
      setStatus('granted')
      return 'granted'
    } catch {
      setStatus('default')
      return 'default'
    }
  }, [])

  return { status, requestPermission }
}
