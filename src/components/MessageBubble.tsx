import type { Message } from '@/lib/socket-client'

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex flex-col ${message.own ? 'items-end' : 'items-start'}`}>
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
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <p className={`text-xs mt-1 text-right ${message.own ? 'text-indigo-300' : 'text-slate-500'}`}>
          {time}
        </p>
      </div>
    </div>
  )
}
