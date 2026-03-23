'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { encryptMessage, decryptMessage, encryptBinary, decryptBinary } from './crypto'
import { clearCryptoKey, zeroizeMessages } from './secure-cleanup'
import {
  generateSessionKeypair,
  exportPubKey,
  importPubKey,
  deriveSharedKey,
  generateRoomKey,
  exportRoomKey,
  importRoomKey,
  encryptRoomKeyEnvelope,
  decryptRoomKeyEnvelope,
} from './ecdh'

export interface ReplyTo {
  id: string
  username: string
  content: string
}

export interface Message {
  id: string
  username: string
  content: string
  timestamp: number
  own: boolean
  replyTo?: ReplyTo
  reactions?: Record<string, number>
  myReactions?: string[]
  /** Decrypted image as an object URL (present for image messages) */
  imageSrc?: string
}

export function useSocket(
  roomId: string,
  username: string,
  ephemeral = false,
  onKicked?: () => void,
  onRoomClosed?: () => void,
  onForceLogout?: () => void,
  onServerDestroyed?: () => void,
  onJoinDenied?: () => void,
  maxParticipants?: number,
  messageTtlSeconds?: number,
  onScreenShareKick?: (kickedUsername: string) => void
) {
  const socketRef = useRef<Socket | null>(null)
  // ECDH: session keypair (private key never leaves memory)
  const keypairRef = useRef<CryptoKeyPair | null>(null)
  const pubKeyB64Ref = useRef<string>('')
  // Room key negotiated via ECDH (replaces the old PBKDF2-derived key)
  const roomKeyRef = useRef<CryptoKey | null>(null)
  // Peers we know about but haven't sent a room-key-offer to yet
  const pendingPeersRef = useRef<Map<string, string>>(new Map()) // socketId → pubKey(b64)
  // Messages queued while roomKey is not yet established
  const pendingMessagesRef = useRef<Array<() => Promise<void>>>([])
  // Timer for fallback: generate own roomKey if no offer arrives within 5s
  const keyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesRef = useRef<Message[]>([])
  const onKickedRef = useRef(onKicked)
  const onRoomClosedRef = useRef(onRoomClosed)
  const onForceLogoutRef = useRef(onForceLogout)
  const onServerDestroyedRef = useRef(onServerDestroyed)
  const onJoinDeniedRef = useRef(onJoinDenied)
  const onScreenShareKickRef = useRef(onScreenShareKick)
  // TTL removal timers: msgId → timeout handle
  const ttlTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Blob URLs created for image messages — revoked on cleanup
  const blobUrls = useRef<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [roomParticipants, setRoomParticipants] = useState<string[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  // Per-user 3s safety timeout map
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Debounce ref for auto-stop after 1s of inactivity
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  // Keep callback refs up to date without re-running the main effect
  useEffect(() => { onKickedRef.current = onKicked }, [onKicked])
  useEffect(() => { onRoomClosedRef.current = onRoomClosed }, [onRoomClosed])
  useEffect(() => { onForceLogoutRef.current = onForceLogout }, [onForceLogout])
  useEffect(() => { onServerDestroyedRef.current = onServerDestroyed }, [onServerDestroyed])
  useEffect(() => { onJoinDeniedRef.current = onJoinDenied }, [onJoinDenied])
  useEffect(() => { onScreenShareKickRef.current = onScreenShareKick }, [onScreenShareKick])

  /** Schedule auto-removal of a message after TTL. Safe to call with no TTL. */
  const scheduleExpiry = useCallback(
    (msgId: string, sentAt: number) => {
      if (!messageTtlSeconds) return
      const remaining = messageTtlSeconds * 1000 - (Date.now() - sentAt)
      if (remaining <= 0) return // already expired — caller should not add this message
      const handle = setTimeout(() => {
        setMessages((prev) => {
          const next = prev.filter((m) => m.id !== msgId)
          messagesRef.current = next
          return next
        })
        ttlTimers.current.delete(msgId)
      }, remaining)
      ttlTimers.current.set(msgId, handle)
    },
    [messageTtlSeconds]
  )

  useEffect(() => {
    let socket: Socket
    // Capture ref value for cleanup (react-hooks/exhaustive-deps)
    const timeouts = typingTimeouts.current
    const timers = ttlTimers.current
    const urls = blobUrls.current

    /**
     * Called once the room key is established (either generated or received).
     * Distributes key offers to pending peers and flushes queued messages.
     */
    async function onRoomKeyEstablished(roomKey: CryptoKey) {
      if (keyTimeoutRef.current) {
        clearTimeout(keyTimeoutRef.current)
        keyTimeoutRef.current = null
      }
      roomKeyRef.current = roomKey

      // Send room key offer to all peers that joined before us or while we had no key
      const peers = pendingPeersRef.current
      if (peers.size > 0 && keypairRef.current) {
        const roomKeyRaw = await exportRoomKey(roomKey)
        for (const [targetSocketId, peerPubKeyB64] of Array.from(peers)) {
          try {
            const peerPubKey = await importPubKey(peerPubKeyB64)
            const sharedKey = await deriveSharedKey(keypairRef.current.privateKey, peerPubKey)
            const envelope = await encryptRoomKeyEnvelope(sharedKey, roomKeyRaw)
            socket?.emit('room-key-offer', {
              roomId,
              targetSocketId,
              ...envelope,
              senderPubKey: pubKeyB64Ref.current,
            })
          } catch {
            // Best-effort — peer may have disconnected
          }
        }
        peers.clear()
      }

      // Flush messages queued before key was ready
      const pending = pendingMessagesRef.current.splice(0)
      for (const fn of pending) {
        await fn()
      }
    }

    async function init() {
      // Generate session keypair once (in-memory, private key never extracted)
      keypairRef.current = await generateSessionKeypair()
      pubKeyB64Ref.current = await exportPubKey(keypairRef.current.publicKey)

      socket = io({ path: '/socket.io' })
      socketRef.current = socket

      socket.on('connect', () => {
        setConnected(true)
        socket.emit('join-room', { roomId, username, ephemeral, maxParticipants })
        // Announce our public key to the room for ECDH key exchange
        socket.emit('key-exchange', { roomId, pubKey: pubKeyB64Ref.current })

        // Fallback: if no room-key-offer arrives within 5s (alone in room), generate our own key
        keyTimeoutRef.current = setTimeout(async () => {
          if (!roomKeyRef.current) {
            const roomKey = await generateRoomKey()
            await onRoomKeyEstablished(roomKey)
          }
        }, 5000)
      })

      // A peer's public key arrived — we need to send them the room key (if we have it)
      // or remember them for when we do
      socket.on('peer-pubkey', async ({ socketId, pubKey }: { socketId: string; pubKey: string }) => {
        if (!keypairRef.current) return

        if (roomKeyRef.current) {
          // We already have the room key — send it to the new peer immediately
          try {
            const roomKeyRaw = await exportRoomKey(roomKeyRef.current)
            const peerPubKey = await importPubKey(pubKey)
            const sharedKey = await deriveSharedKey(keypairRef.current.privateKey, peerPubKey)
            const envelope = await encryptRoomKeyEnvelope(sharedKey, roomKeyRaw)
            socket.emit('room-key-offer', {
              roomId,
              targetSocketId: socketId,
              ...envelope,
              senderPubKey: pubKeyB64Ref.current,
            })
          } catch {
            // Best-effort
          }
        } else {
          // We don't have the room key yet — remember this peer for later
          pendingPeersRef.current.set(socketId, pubKey)
          // A peer is present who will send us a room-key-offer — cancel the solo fallback timer
          if (keyTimeoutRef.current) {
            clearTimeout(keyTimeoutRef.current)
            keyTimeoutRef.current = null
          }
        }
      })

      // A peer sent us an encrypted room key envelope
      socket.on(
        'room-key-offer',
        async ({
          encryptedRoomKey,
          iv,
          senderPubKey,
        }: {
          encryptedRoomKey: string
          iv: string
          senderPubKey: string
        }) => {
          if (roomKeyRef.current) return // already have key — ignore duplicate offers
          if (!keypairRef.current) return
          try {
            const senderKey = await importPubKey(senderPubKey)
            const sharedKey = await deriveSharedKey(keypairRef.current.privateKey, senderKey)
            const roomKeyRaw = await decryptRoomKeyEnvelope(sharedKey, encryptedRoomKey, iv)
            const roomKey = await importRoomKey(roomKeyRaw)
            await onRoomKeyEstablished(roomKey)
          } catch {
            // Corrupted envelope — ignore
          }
        }
      )

      socket.on('room-users', (count: number) => {
        setOnlineCount(count)
      })

      socket.on('room-users-list', (participants: string[]) => {
        setRoomParticipants(participants)
      })

      socket.on('room-owner', () => {
        setIsOwner(true)
      })

      socket.on('kicked', () => {
        onKickedRef.current?.()
      })

      socket.on('room-closed', () => {
        onRoomClosedRef.current?.()
      })

      socket.on('force-logout', async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
      })

      socket.on('server-destroyed', () => {
        onServerDestroyedRef.current?.()
      })

      socket.on('join-denied', () => {
        onJoinDeniedRef.current?.()
      })

      socket.on('user:kicked-screen-share', ({ username: kickedUsername }: { username: string }) => {
        onScreenShareKickRef.current?.(kickedUsername)
      })

      socket.on('user-typing', ({ username: typingUsername }: { username: string }) => {
        setTypingUsers((prev) =>
          prev.includes(typingUsername) ? prev : [...prev, typingUsername]
        )
        // Reset 3s safety timeout for this user
        const existing = typingTimeouts.current.get(typingUsername)
        if (existing) clearTimeout(existing)
        typingTimeouts.current.set(
          typingUsername,
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u !== typingUsername))
            typingTimeouts.current.delete(typingUsername)
          }, 3000)
        )
      })

      socket.on('user-stopped-typing', ({ username: typingUsername }: { username: string }) => {
        const existing = typingTimeouts.current.get(typingUsername)
        if (existing) clearTimeout(existing)
        typingTimeouts.current.delete(typingUsername)
        setTypingUsers((prev) => prev.filter((u) => u !== typingUsername))
      })

      socket.on(
        'receive-message',
        async (data: {
          ciphertext: string
          iv: string
          username: string
          timestamp: number
          msgId: string
          replyTo?: ReplyTo
        }) => {
          if (!roomKeyRef.current) return
          try {
            const content = await decryptMessage(
              roomKeyRef.current,
              data.ciphertext,
              data.iv
            )
            // Discard if TTL already expired before we received it
            if (messageTtlSeconds && Date.now() - data.timestamp >= messageTtlSeconds * 1000) return
            const newMsg: Message = {
              id: data.msgId,
              username: data.username,
              content,
              timestamp: data.timestamp,
              own: false,
              replyTo: data.replyTo,
            }
            setMessages((prev) => {
              const next = [...prev, newMsg]
              messagesRef.current = next
              return next
            })
            scheduleExpiry(data.msgId, data.timestamp)
          } catch {
            // Silently ignore decrypt errors (wrong room key / corrupted data)
          }
        }
      )

      socket.on(
        'reaction-updated',
        ({ messageId, counts }: { messageId: string; counts: Record<string, number> }) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions: counts } : m))
          )
        }
      )

      socket.on(
        'my-reaction-state',
        ({ messageId, myReactions }: { messageId: string; myReactions: string[] }) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, myReactions } : m))
          )
        }
      )

      socket.on(
        'receive-image',
        async (data: {
          imageId: string
          iv: string
          username: string
          timestamp: number
          msgId: string
        }) => {
          if (!roomKeyRef.current) return
          if (messageTtlSeconds && Date.now() - data.timestamp >= messageTtlSeconds * 1000) return
          try {
            const res = await fetch(`/api/rooms/${roomId}/images/${data.imageId}`)
            if (!res.ok) return
            const encrypted = await res.arrayBuffer()
            const plain = await decryptBinary(roomKeyRef.current, encrypted, data.iv)
            const blob = new Blob([plain], { type: 'image/webp' })
            const imageSrc = URL.createObjectURL(blob)
            urls.push(imageSrc)
            const newMsg: Message = {
              id: data.msgId,
              username: data.username,
              content: '',
              timestamp: data.timestamp,
              own: false,
              imageSrc,
            }
            setMessages((prev) => {
              const next = [...prev, newMsg]
              messagesRef.current = next
              return next
            })
            scheduleExpiry(data.msgId, data.timestamp)
          } catch {
            // Silently ignore decrypt/fetch errors
          }
        }
      )

      socket.on('disconnect', () => {
        setConnected(false)
      })
    }

    init()

    return () => {
      if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current)
      if (typingDebounce.current) clearTimeout(typingDebounce.current)
      timeouts.forEach((t) => clearTimeout(t))
      timeouts.clear()
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.length = 0
      socket?.emit('leave-room', roomId)
      socket?.disconnect()
    }
  }, [roomId, username, ephemeral, maxParticipants, messageTtlSeconds, scheduleExpiry])

  /** Zeroize sensitive data from memory (best-effort). */
  const cleanup = useCallback(() => {
    zeroizeMessages(messagesRef.current)
    clearCryptoKey(roomKeyRef)
    keypairRef.current = null
    setMessages([])
    messagesRef.current = []
  }, [])

  const sendMessage = useCallback(
    async (plaintext: string, replyTo?: ReplyTo) => {
      if (!socketRef.current) return

      const doSend = async () => {
        if (!socketRef.current || !roomKeyRef.current) return
        const { ciphertext, iv } = await encryptMessage(roomKeyRef.current, plaintext)
        const timestamp = Date.now()
        const msgId = `${timestamp}-${username}-${Math.random().toString(36).slice(2)}`
        socketRef.current.emit('send-message', {
          roomId,
          ciphertext,
          iv,
          username,
          timestamp,
          msgId,
          replyTo,
        })
        const ownMsg: Message = {
          id: msgId,
          username,
          content: plaintext,
          timestamp,
          own: true,
          replyTo,
        }
        setMessages((prev) => {
          const next = [...prev, ownMsg]
          messagesRef.current = next
          return next
        })
        scheduleExpiry(msgId, timestamp)
      }

      if (!roomKeyRef.current) {
        // Queue until room key is established
        pendingMessagesRef.current.push(doSend)
        return
      }

      await doSend()
    },
    [roomId, username, scheduleExpiry]
  )

  const sendTypingStart = useCallback(() => {
    if (!socketRef.current) return
    if (!isTypingRef.current) {
      isTypingRef.current = true
      socketRef.current.emit('typing-start', { roomId, username })
    }
    // Debounce: schedule auto-stop after 1s of inactivity
    if (typingDebounce.current) clearTimeout(typingDebounce.current)
    typingDebounce.current = setTimeout(() => {
      isTypingRef.current = false
      socketRef.current?.emit('typing-stop', { roomId, username })
    }, 1000)
  }, [roomId, username])

  const sendTypingStop = useCallback(() => {
    if (typingDebounce.current) clearTimeout(typingDebounce.current)
    if (isTypingRef.current) {
      isTypingRef.current = false
      socketRef.current?.emit('typing-stop', { roomId, username })
    }
  }, [roomId, username])

  const sendReaction = useCallback(
    (messageId: string, emoji: string) => {
      socketRef.current?.emit('react-to-message', { roomId, messageId, emoji })
    },
    [roomId]
  )

  const kickUser = useCallback(
    (targetUsername: string) => {
      socketRef.current?.emit('kick-user', { roomId, targetUsername })
    },
    [roomId]
  )

  const closeRoom = useCallback(() => {
    socketRef.current?.emit('close-room', { roomId })
  }, [roomId])

  const disconnect = useCallback(() => {
    socketRef.current?.emit('leave-room', roomId)
    socketRef.current?.disconnect()
  }, [roomId])

  const reportScreenShare = useCallback(() => {
    socketRef.current?.emit('screen:sharing-detected', { roomId, username })
  }, [roomId, username])

  const sendImage = useCallback(
    async (file: File): Promise<{ error?: string }> => {
      if (!socketRef.current) return { error: 'Não conectado' }

      // Convert to WebP immediately — doesn't require roomKey
      let webpBlob: Blob
      try {
        const bitmap = await createImageBitmap(file)
        const MAX_DIM = 1920
        let { width, height } = bitmap
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
        webpBlob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/webp', 0.85)
        )
      } catch {
        return { error: 'Erro ao processar imagem' }
      }

      // Encrypt, upload and emit — requires roomKey; queued if not yet available
      const doSend = async () => {
        if (!socketRef.current || !roomKeyRef.current) return
        const { ciphertext, iv } = await encryptBinary(roomKeyRef.current, await webpBlob.arrayBuffer())
        const res = await fetch(`/api/rooms/${roomId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: ciphertext,
        })
        if (!res.ok) return
        const { imageId } = (await res.json()) as { imageId: string }
        const timestamp = Date.now()
        const msgId = `${timestamp}-${username}-${Math.random().toString(36).slice(2)}`
        socketRef.current.emit('send-image', { roomId, imageId, iv, username, timestamp, msgId })
        const imageSrc = URL.createObjectURL(webpBlob)
        blobUrls.current.push(imageSrc)
        setMessages((prev) => {
          const next = [...prev, { id: msgId, username, content: '', timestamp, own: true, imageSrc }]
          messagesRef.current = next
          return next
        })
        scheduleExpiry(msgId, timestamp)
      }

      if (!roomKeyRef.current) {
        pendingMessagesRef.current.push(doSend)
        return {}
      }

      await doSend()
      return {}
    },
    [roomId, username, scheduleExpiry]
  )

  return {
    messages,
    onlineCount,
    connected,
    sendMessage,
    sendImage,
    sendReaction,
    cleanup,
    disconnect,
    isOwner,
    roomParticipants,
    kickUser,
    closeRoom,
    reportScreenShare,
    typingUsers,
    sendTypingStart,
    sendTypingStop,
  }
}
