import type { Message } from '@/lib/socket-client'

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '🔥', '👏'] as const

interface Props {
  message: Message
  onReply?: (msg: Message) => void
  onReact?: (messageId: string, emoji: string) => void
}

export default function MessageBubble({ message, onReply, onReact }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const hasReactions = message.reactions && Object.values(message.reactions).some((c) => c > 0)

  return (
    <div className={`flex flex-col group ${message.own ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          message.own
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-100 rounded-bl-sm'
        }`}
      >
        {!message.own && (
          <p className="text-xs font-semibold text-indigo-400 mb-1">{message.username}</p>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div
            className={`mb-2 rounded-lg px-3 py-1.5 border-l-2 ${
              message.own
                ? 'bg-indigo-700/50 border-indigo-300'
                : 'bg-slate-700/60 border-indigo-400'
            }`}
          >
            <p className={`text-xs font-semibold mb-0.5 ${message.own ? 'text-indigo-200' : 'text-indigo-400'}`}>
              ↩ {message.replyTo.username}
            </p>
            <p className={`text-xs truncate ${message.own ? 'text-indigo-200' : 'text-slate-400'}`}>
              {message.replyTo.content.length > 80
                ? message.replyTo.content.slice(0, 80) + '…'
                : message.replyTo.content}
            </p>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`text-xs mt-1 text-right ${message.own ? 'text-indigo-300' : 'text-slate-500'}`}>
          {time}
        </p>
      </div>

      {/* Reactions display */}
      {hasReactions && (
        <div className="flex flex-wrap gap-1 mt-1 px-1">
          {EMOJI_LIST.filter((e) => (message.reactions?.[e] ?? 0) > 0).map((emoji) => {
            const reacted = message.myReactions?.includes(emoji) ?? false
            return (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs transition-colors ${
                  reacted
                    ? 'bg-indigo-600 hover:bg-indigo-500 ring-1 ring-indigo-400'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <span>{emoji}</span>
                <span className={reacted ? 'text-indigo-200' : 'text-slate-300'}>
                  {message.reactions![emoji]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Hover actions */}
      <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${message.own ? 'flex-row-reverse' : ''}`}>
        {onReply && (
          <button
            onClick={() => onReply(message)}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded transition-colors"
          >
            ↩ responder
          </button>
        )}
        {onReact && EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact(message.id, emoji)}
            className="text-sm hover:scale-125 transition-transform px-0.5"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
