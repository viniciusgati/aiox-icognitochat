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
  onForceLogout?: () => void
) {
  const socketRef = useRef<Socket | null>(null)
  const keyRef = useRef<CryptoKey | null>(null)
  const messagesRef = useRef<Message[]>([])
  const onKickedRef = useRef(onKicked)
  const onRoomClosedRef = useRef(onRoomClosed)
  const onForceLogoutRef = useRef(onForceLogout)
  const [messages, setMessages] = useState<Message[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [roomParticipants, setRoomParticipants] = useState<string[]>([])

  // Keep callback refs up to date without re-running the main effect
  useEffect(() => { onKickedRef.current = onKicked }, [onKicked])
  useEffect(() => { onRoomClosedRef.current = onRoomClosed }, [onRoomClosed])
  useEffect(() => { onForceLogoutRef.current = onForceLogout }, [onForceLogout])

  useEffect(() => {
    let socket: Socket

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
  }
}
