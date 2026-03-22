'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { deriveRoomKey, encryptMessage, decryptMessage } from './crypto'
import { clearCryptoKey, zeroizeMessages } from './secure-cleanup'

export interface Message {
  id: string
  username: string
  content: string
  timestamp: number
  own: boolean
}

export function useSocket(
  roomId: string,
  username: string,
  ephemeral = false,
  onKicked?: () => void,
  onRoomClosed?: () => void,
  onForceLogout?: () => void,
  onServerDestroyed?: () => void
) {
  const socketRef = useRef<Socket | null>(null)
  const keyRef = useRef<CryptoKey | null>(null)
  const messagesRef = useRef<Message[]>([])
  const onKickedRef = useRef(onKicked)
  const onRoomClosedRef = useRef(onRoomClosed)
  const onForceLogoutRef = useRef(onForceLogout)
  const onServerDestroyedRef = useRef(onServerDestroyed)
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

  useEffect(() => {
    let socket: Socket
    // Capture ref value for cleanup (react-hooks/exhaustive-deps)
    const timeouts = typingTimeouts.current

    async function init() {
      keyRef.current = await deriveRoomKey(roomId)

      socket = io({ path: '/socket.io' })
      socketRef.current = socket

      socket.on('connect', () => {
        setConnected(true)
        socket.emit('join-room', { roomId, username, ephemeral })
      })

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
        }) => {
          if (!keyRef.current) return
          try {
            const content = await decryptMessage(
              keyRef.current,
              data.ciphertext,
              data.iv
            )
            const newMsg: Message = {
              id: `${data.timestamp}-${data.username}-${Math.random()}`,
              username: data.username,
              content,
              timestamp: data.timestamp,
              own: false,
            }
            setMessages((prev) => {
              const next = [...prev, newMsg]
              messagesRef.current = next
              return next
            })
          } catch {
            // Silently ignore decrypt errors (wrong room key / corrupted data)
          }
        }
      )

      socket.on('disconnect', () => {
        setConnected(false)
      })
    }

    init()

    return () => {
      if (typingDebounce.current) clearTimeout(typingDebounce.current)
      timeouts.forEach((t) => clearTimeout(t))
      timeouts.clear()
      socket?.emit('leave-room', roomId)
      socket?.disconnect()
    }
  }, [roomId, username, ephemeral])

  /** Zeroize sensitive data from memory (best-effort). */
  const cleanup = useCallback(() => {
    zeroizeMessages(messagesRef.current)
    clearCryptoKey(keyRef)
    setMessages([])
    messagesRef.current = []
  }, [])

  const sendMessage = useCallback(
    async (plaintext: string) => {
      if (!socketRef.current || !keyRef.current) return
      const { ciphertext, iv } = await encryptMessage(keyRef.current, plaintext)
      const timestamp = Date.now()
      socketRef.current.emit('send-message', {
        roomId,
        ciphertext,
        iv,
        username,
        timestamp,
      })
      const ownMsg: Message = {
        id: `${timestamp}-own`,
        username,
        content: plaintext,
        timestamp,
        own: true,
      }
      setMessages((prev) => {
        const next = [...prev, ownMsg]
        messagesRef.current = next
        return next
      })
    },
    [roomId, username]
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

  const kickUser = useCallback(
    (targetUsername: string) => {
      socketRef.current?.emit('kick-user', { roomId, targetUsername })
    },
    [roomId]
  )

  const closeRoom = useCallback(() => {
    socketRef.current?.emit('close-room', { roomId })
  }, [roomId])

  return {
    messages,
    onlineCount,
    connected,
    sendMessage,
    cleanup,
    isOwner,
    roomParticipants,
    kickUser,
    closeRoom,
    typingUsers,
    sendTypingStart,
    sendTypingStop,
  }
}
