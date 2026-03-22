'use client'

import { useRef, useEffect, useState, KeyboardEvent, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/socket-client'
import MessageBubble from './MessageBubble'

interface Props {
  roomId: string
  username: string
  roomName: string
  isEphemeral?: boolean
}

export default function ChatWindow({ roomId, username, roomName, isEphemeral = false }: Props) {
  const router = useRouter()
  const { messages, onlineCount, connected, sendMessage, cleanup, isOwner, roomParticipants, kickUser, closeRoom, typingUsers, sendTypingStart, sendTypingStop } = useSocket(
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
    }, [router])
  )
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || !connected) return
    sendTypingStop()
    setInput('')
    await sendMessage(text)
  }

  const displayName = isEphemeral ? 'Sala Rápida' : roomName
  const showAdminControls = isOwner && isEphemeral

  return (
    // h-dvh: uses dynamic viewport height — accounts for mobile browser chrome/keyboard
    <div className="flex flex-col h-dvh bg-slate-900 text-slate-100 overscroll-none">
      {/* Header — pt-safe for notch */}
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3 shrink-0 pt-safe">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="text-slate-400 hover:text-slate-200 transition-colors text-lg leading-none"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-slate-100 font-semibold">#{displayName}</span>
            {isEphemeral && (
              <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
                efêmera
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {showAdminControls && (
            <button
              onClick={handleCloseRoom}
              className="rounded-lg bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              Fechar Sala
            </button>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-600'}`}
            />
            <span>{onlineCount} online</span>
          </div>
        </div>
      </header>

      {/* Share link banner — ephemeral rooms only */}
      {isEphemeral && (
        <div className="shrink-0 bg-indigo-900/40 border-b border-indigo-800 px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-indigo-300 font-medium">Compartilhe o link para conversar</p>
            <p className="text-xs text-slate-500 truncate">{typeof window !== 'undefined' ? window.location.href : ''}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      {/* Owner participants panel — ephemeral rooms only */}
      {showAdminControls && roomParticipants.length > 0 && (
        <div className="shrink-0 bg-slate-800/60 border-b border-slate-700 px-4 py-2">
          <p className="text-xs text-slate-400 font-medium mb-1.5">Participantes</p>
          <div className="flex flex-wrap gap-2">
            {roomParticipants.map((participant) => (
              <div key={participant} className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300">{participant}</span>
                {participant !== username && (
                  <button
                    onClick={() => handleKickUser(participant)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors leading-none"
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

      {/* Ephemeral warning */}
      {isEphemeral && messages.length === 0 && (
        <div className="shrink-0 bg-amber-900/20 border-b border-amber-800/40 px-4 py-2">
          <p className="text-xs text-amber-400 text-center">
            ⚠️ Sala efêmera — histórico apagado quando todos saírem
          </p>
        </div>
      )}

      {/* Messages — touch scrolling, overscroll-contain prevents page bounce */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-sm mt-8">
            {isEphemeral
              ? 'Aguardando a outra pessoa entrar…'
              : 'Seja o primeiro a enviar uma mensagem!'}
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="shrink-0 px-4 py-1.5 text-xs text-slate-400 italic">
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

      {/* Input — pb-safe for home bar on iOS/Android */}
      <div className="border-t border-slate-700 p-4 shrink-0 pb-safe">
        <div className="flex gap-2 items-end">
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
            placeholder="Mensagem… (Enter para enviar, Shift+Enter para nova linha)"
            className="flex-1 resize-none rounded-lg bg-slate-800 border border-slate-600 px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-semibold text-white transition-colors shrink-0"
          >
            Enviar
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">
          🔒 Mensagens criptografadas E2E — o servidor não lê o conteúdo
        </p>
      </div>
    </div>
  )
}
