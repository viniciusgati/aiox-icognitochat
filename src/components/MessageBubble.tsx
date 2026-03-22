import React, { useState } from 'react'
import type { Message } from '@/lib/socket-client'
import { getUserColor, getUserInitials } from '@/lib/user-color'
import WatermarkedImage from './WatermarkedImage'

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '🔥', '👏'] as const

interface Props {
  message: Message
  roomId: string
  onReply?: (msg: Message) => void
  onReact?: (messageId: string, emoji: string) => void
}

function Avatar({ username }: { username: string }) {
  const color = getUserColor(username)
  const initials = getUserInitials(username)
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 select-none"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function ImageLightbox({
  src, alt, username, roomId, timestamp, onClose,
}: {
  src: string; alt: string; username: string; roomId: string; timestamp: number; onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <WatermarkedImage
        src={src}
        alt={alt}
        username={username}
        roomId={roomId}
        timestamp={timestamp}
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
        onClick={(e) => e?.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none bg-black/40 rounded-full w-9 h-9 flex items-center justify-center transition-colors"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

export default function MessageBubble({ message, roomId, onReply, onReact }: Props) {
  const [lightbox, setLightbox] = useState(false)
  const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const hasReactions = message.reactions && Object.values(message.reactions).some((c) => c > 0)
  const isImage = Boolean(message.imageSrc)

  return (
    <>
    <div className={`flex gap-2 group ${message.own ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar — only for others */}
      {!message.own && (
        <div className="mt-1">
          <Avatar username={message.username} />
        </div>
      )}

      <div className={`flex flex-col ${message.own ? 'items-end' : 'items-start'} max-w-[78%]`}>
        {/* Sender name — only for others */}
        {!message.own && !isImage && (
          <span
            className="text-[11px] font-semibold mb-1 ml-1"
            style={{ color: getUserColor(message.username) }}
          >
            {message.username}
          </span>
        )}

        <div
          className={`rounded-2xl ${
            isImage ? 'overflow-hidden p-0' : 'px-3.5 py-2.5'
          } ${
            message.own
              ? 'bubble-own text-white rounded-br-sm shadow-glow-sm'
              : 'bg-surface-800 border border-white/[0.06] text-zinc-100 rounded-bl-sm'
          }`}
        >
          {/* Reply preview */}
          {message.replyTo && (
            <div
              className={`mb-2 rounded-lg px-3 py-1.5 border-l-2 ${
                message.own
                  ? 'bg-white/10 border-white/40'
                  : 'bg-white/5 border-brand-500'
              }`}
            >
              <p className={`text-[11px] font-semibold mb-0.5 ${message.own ? 'text-indigo-200' : 'text-brand-400'}`}>
                ↩ {message.replyTo.username}
              </p>
              <p className={`text-xs truncate ${message.own ? 'text-indigo-200/70' : 'text-zinc-400'}`}>
                {message.replyTo.content.length > 80
                  ? message.replyTo.content.slice(0, 80) + '…'
                  : message.replyTo.content}
              </p>
            </div>
          )}

          {/* Image or text */}
          {isImage ? (
            <div className="relative">
              {!message.own && (
                <p className="absolute top-2 left-2 text-[11px] font-semibold text-white drop-shadow bg-black/50 rounded-md px-1.5 py-0.5">
                  {message.username}
                </p>
              )}
              <WatermarkedImage
                src={message.imageSrc!}
                alt={`Imagem de ${message.username}`}
                username={message.username}
                roomId={roomId}
                timestamp={message.timestamp}
                className="max-w-xs max-h-72 object-contain block"
                onClick={() => setLightbox(true)}
              />
              <p className={`text-[10px] px-2 py-0.5 text-right ${message.own ? 'text-white/50' : 'text-zinc-500'}`}>
                {time}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
              <p className={`text-[10px] mt-1 text-right ${message.own ? 'text-white/50' : 'text-zinc-500'}`}>
                {time}
              </p>
            </>
          )}
        </div>

        {/* Reactions display */}
        {hasReactions && (
          <div className="flex flex-wrap gap-1 mt-1.5 px-1">
            {EMOJI_LIST.filter((e) => (message.reactions?.[e] ?? 0) > 0).map((emoji) => {
              const reacted = message.myReactions?.includes(emoji) ?? false
              return (
                <button
                  key={emoji}
                  onClick={() => onReact?.(message.id, emoji)}
                  className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium transition-all duration-150 ${
                    reacted
                      ? 'bg-brand-500/20 border border-brand-500/50 text-brand-400 hover:bg-brand-500/30'
                      : 'bg-surface-700 border border-white/[0.06] text-zinc-400 hover:bg-surface-600'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="ml-0.5">{message.reactions![emoji]}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Hover actions */}
        <div className={`flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-all duration-150 ${message.own ? 'flex-row-reverse' : ''}`}>
          {onReply && !isImage && (
            <button
              onClick={() => onReply(message)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded-lg hover:bg-surface-700 transition-colors"
            >
              ↩ responder
            </button>
          )}
          <div className="flex items-center gap-0.5">
            {onReact && EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="text-sm hover:scale-125 transition-transform p-0.5 rounded hover:bg-surface-700"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

    {lightbox && message.imageSrc && (
      <ImageLightbox
        src={message.imageSrc}
        alt={`Imagem de ${message.username}`}
        username={message.username}
        roomId={roomId}
        timestamp={message.timestamp}
        onClose={() => setLightbox(false)}
      />
    )}
    </>
  )
}
