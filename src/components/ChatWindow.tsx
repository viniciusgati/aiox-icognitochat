'use client'

import React, { useRef, useEffect, useState, KeyboardEvent, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/socket-client'
import type { Message, ReplyTo } from '@/lib/socket-client'
import MessageBubble from './MessageBubble'
import NotificationSettings from './NotificationSettings'
import { getPrefs, playSound } from '@/lib/notification-prefs'
import { usePushSubscription } from '@/lib/use-push-subscription'

interface Props {
  roomId: string
  username: string
  roomName: string
  isEphemeral?: boolean
  maxParticipants?: number
  messageTtlSeconds?: number
}

function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`
  if (seconds < 3600) return `${seconds / 60} ${seconds / 60 === 1 ? 'minuto' : 'minutos'}`
  return `${seconds / 3600} hora`
}

export default function ChatWindow({ roomId, username, roomName, isEphemeral = false, maxParticipants, messageTtlSeconds }: Props) {
  const router = useRouter()
  const {
    messages,
    onlineCount,
    connected,
    sendMessage,
    sendImage,
    sendReaction,
    cleanup,
    isOwner,
    roomParticipants,
    kickUser,
    closeRoom,
    typingUsers,
    sendTypingStart,
    sendTypingStop,
  } = useSocket(
    roomId,
    username,
    isEphemeral,
    useCallback(() => {
      alert('Você foi removido da sala')
      router.push('/chat')
    }, [router]),
    useCallback(() => {
      alert('A sala foi encerrada pelo criador')
      router.push('/chat')
    }, [router]),
    undefined,
    useCallback(() => {
      alert('O servidor foi encerrado pelo administrador')
      router.push('/')
    }, [router]),
    useCallback(() => {
      alert('Sala lotada — limite de participantes atingido')
      router.push('/chat')
    }, [router]),
    maxParticipants,
    messageTtlSeconds
  )

  const { status: pushStatus, error: pushError, requestPermission: requestPush } = usePushSubscription()

  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null)
  const [imageError, setImageError] = useState('')
  const [sendingImage, setSendingImage] = useState(false)
  const [showNotifSettings, setShowNotifSettings] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Tab badge: unread count when tab is hidden
  const unreadRef = useRef(0)
  const originalTitleRef = useRef<string>('')

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Tab badge + notification sound when window is hidden
  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.own) return
    if (document.hidden) {
      unreadRef.current += 1
      document.title = `(${unreadRef.current}) IcognitoChat`
      const prefs = getPrefs()
      if (prefs.enabled) playSound(prefs.sound)
    }
  }, [messages])

  // Reset badge on focus
  useEffect(() => {
    originalTitleRef.current = document.title.replace(/^\(\d+\)\s*/, '')
    const reset = () => {
      unreadRef.current = 0
      document.title = originalTitleRef.current || 'IcognitoChat'
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) reset()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', reset)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', reset)
    }
  }, [])

  // Secure cleanup: zeroize key + messages on tab/browser close and on unmount
  useEffect(() => {
    window.addEventListener('beforeunload', cleanup)
    return () => {
      window.removeEventListener('beforeunload', cleanup)
      cleanup()
    }
  }, [cleanup])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the URL from a hidden input
    }
  }, [])

  const handleKickUser = useCallback(
    (targetUsername: string) => {
      kickUser(targetUsername)
    },
    [kickUser]
  )

  const handleCloseRoom = useCallback(() => {
    if (window.confirm('Fechar a sala vai desconectar todos e apagar tudo. Confirmar?')) {
      closeRoom()
    }
  }, [closeRoom])

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo({ id: msg.id, username: msg.username, content: msg.content })
  }, [])

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      sendReaction(messageId, emoji)
    },
    [sendReaction]
  )

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!fileInputRef.current) return
      fileInputRef.current.value = ''
      if (!file) return
      setImageError('')
      setSendingImage(true)
      const result = await sendImage(file)
      setSendingImage(false)
      if (result.error) setImageError(result.error)
    },
    [sendImage]
  )

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setReplyingTo(null)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || !connected) return
    sendTypingStop()
    setInput('')
    await sendMessage(text, replyingTo ?? undefined)
    setReplyingTo(null)
  }

  const displayName = isEphemeral ? 'Sala Rápida' : roomName
  const showAdminControls = isOwner && isEphemeral

  return (
    <div className="fixed inset-0 flex flex-col bg-surface-950 text-zinc-100 overflow-hidden safe-top">
      {/* Header — glass effect */}
      <header className="glass flex items-center justify-between border-b border-white/[0.06] px-4 py-3 shrink-0 z-50 relative">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-zinc-100 font-semibold">#{displayName}</span>
            {isEphemeral && (
              <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                efêmera
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {showAdminControls && (
            <button
              onClick={handleCloseRoom}
              className="rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all duration-150"
            >
              Fechar Sala
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`}
            />
            <span>{onlineCount}</span>
          </div>
          {/* Notification settings button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifSettings((v) => !v)}
              className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm leading-none p-1 rounded-lg hover:bg-surface-700"
              title="Configurações de notificação"
              aria-label="Notificações"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            {showNotifSettings && (
              <NotificationSettings
                onClose={() => setShowNotifSettings(false)}
                pushStatus={pushStatus}
                pushError={pushError}
                onRequestPush={requestPush}
              />
            )}
          </div>
        </div>
      </header>

      {/* Share link banner — ephemeral rooms only */}
      {isEphemeral && (
        <div className="shrink-0 bg-brand-500/8 border-b border-brand-500/15 px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-brand-400 font-medium">Compartilhe o link para conversar</p>
            <p className="text-[11px] text-zinc-600 truncate">{typeof window !== 'undefined' ? window.location.href : ''}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="shrink-0 rounded-lg bg-brand-500 hover:bg-brand-400 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      {/* Owner participants panel — ephemeral rooms only */}
      {showAdminControls && roomParticipants.length > 0 && (
        <div className="shrink-0 bg-surface-800/60 border-b border-white/[0.06] px-4 py-2">
          <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide mb-1.5">Participantes</p>
          <div className="flex flex-wrap gap-2">
            {roomParticipants.map((participant) => (
              <div key={participant} className="flex items-center gap-1.5 bg-surface-700 rounded-lg px-2 py-0.5">
                <span className="text-xs text-zinc-300">{participant}</span>
                {participant !== username && (
                  <button
                    onClick={() => handleKickUser(participant)}
                    className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors leading-none"
                    title={`Remover ${participant}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TTL banner */}
      {messageTtlSeconds && (
        <div className="shrink-0 bg-rose-500/8 border-b border-rose-500/15 px-4 py-1.5">
          <p className="text-[11px] text-rose-400 text-center">
            🔥 Mensagens se autodestroem em {formatTtl(messageTtlSeconds)}
          </p>
        </div>
      )}

      {/* Ephemeral warning */}
      {isEphemeral && messages.length === 0 && (
        <div className="shrink-0 bg-amber-500/8 border-b border-amber-500/15 px-4 py-2">
          <p className="text-xs text-amber-400/80 text-center">
            ⚠️ Sala efêmera — histórico apagado quando todos saírem
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.length === 0 && (
          <p className="text-center text-zinc-600 text-sm mt-12">
            {isEphemeral
              ? 'Aguardando a outra pessoa entrar…'
              : 'Seja o primeiro a enviar uma mensagem!'}
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            roomId={roomId}
            onReply={handleReply}
            onReact={handleReact}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="shrink-0 px-5 py-1.5 text-[11px] text-zinc-500 italic">
          {typingUsers.length === 1
            ? `${typingUsers[0]} está digitando`
            : typingUsers.length === 2
              ? `${typingUsers[0]} e ${typingUsers[1]} estão digitando`
              : `${typingUsers[0]}, ${typingUsers[1]} e outros estão digitando`}
          <span className="inline-flex gap-0.5 ml-1">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
        </div>
      )}

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="shrink-0 bg-surface-800 border-t border-white/[0.06] px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-brand-400 font-medium">↩ Respondendo a {replyingTo.username}</p>
            <p className="text-xs text-zinc-500 truncate">
              {replyingTo.content.length > 80 ? replyingTo.content.slice(0, 80) + '…' : replyingTo.content}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors text-base leading-none"
            aria-label="Cancelar resposta"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input area — pb-safe for home bar on iOS/Android */}
      <div className="glass border-t border-white/[0.06] px-4 py-3 shrink-0 pb-safe">
        {imageError && (
          <p className="text-xs text-red-400 mb-2 text-center">{imageError}</p>
        )}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            onClick={() => { setImageError(''); fileInputRef.current?.click() }}
            disabled={!connected || sendingImage}
            className="shrink-0 rounded-xl bg-surface-700 hover:bg-surface-600 border border-white/[0.06] disabled:opacity-40 p-2 text-zinc-400 hover:text-zinc-200 transition-all duration-150"
            title="Enviar imagem"
            aria-label="Enviar imagem"
          >
            {sendingImage ? (
              <span className="block w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </button>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              if (e.target.value) {
                sendTypingStart()
              } else {
                sendTypingStop()
              }
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Mensagem…"
            className="flex-1 resize-none rounded-xl bg-surface-800 border border-white/[0.07] px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all duration-150 max-h-32 overflow-y-auto text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="rounded-xl bubble-own hover:opacity-90 disabled:opacity-30 px-4 py-2.5 font-semibold text-white transition-all duration-150 shrink-0 text-sm shadow-glow-sm"
          >
            Enviar
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 mt-2 text-center">
          🔒 E2E — o servidor não lê o conteúdo
        </p>
      </div>
    </div>
  )
}
