import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { zeroizeDb, deleteRoom } from '@/lib/db'

declare global {
  // eslint-disable-next-line no-var
  var io: SocketIOServer
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

function gracefulShutdown(signal: string) {
  if (dev) console.log(`[Server] Received ${signal}, zeroizing DB and shutting down...`)
  zeroizeDb()
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? '*' : process.env.NEXT_PUBLIC_BASE_URL,
      methods: ['GET', 'POST'],
    },
  })

  // Store io instance globally so API routes can access it
  global.io = io

  // Presence tracking: roomId → Map<socketId, username>
  const roomUsers = new Map<string, Map<string, string>>()
  // Ephemeral rooms: deleted from DB when last user leaves
  const ephemeralRooms = new Set<string>()

  function handleRoomEmpty(roomId: string) {
    if (ephemeralRooms.has(roomId)) {
      deleteRoom(roomId)
      ephemeralRooms.delete(roomId)
      roomUsers.delete(roomId)
      if (dev) console.log(`[Socket.io] Ephemeral room deleted: ${roomId}`)
    }
  }

  io.on('connection', (socket) => {
    if (dev) console.log(`[Socket.io] Client connected: ${socket.id}`)

    socket.on(
      'join-room',
      ({
        roomId,
        username,
        ephemeral,
      }: {
        roomId: string
        username: string
        ephemeral?: boolean
      }) => {
        socket.join(roomId)
        if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map())
        roomUsers.get(roomId)!.set(socket.id, username)
        if (ephemeral) ephemeralRooms.add(roomId)
        const count = roomUsers.get(roomId)!.size
        io.to(roomId).emit('room-users', count)
        if (dev)
          console.log(
            `[Socket.io] ${username} joined room: ${roomId} (ephemeral: ${!!ephemeral}) — ${count} online`
          )
      }
    )

    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId)
      roomUsers.get(roomId)?.delete(socket.id)
      const count = roomUsers.get(roomId)?.size ?? 0
      io.to(roomId).emit('room-users', count)
      if (count === 0) handleRoomEmpty(roomId)
    })

    socket.on(
      'send-message',
      (data: {
        roomId: string
        ciphertext: string
        iv: string
        username: string
        timestamp: number
      }) => {
        // Relay encrypted payload — server never reads plaintext
        socket.to(data.roomId).emit('receive-message', {
          ciphertext: data.ciphertext,
          iv: data.iv,
          username: data.username,
          timestamp: data.timestamp,
        })
      }
    )

    socket.on('disconnect', () => {
      // Remove from all tracked rooms on unexpected disconnect
      roomUsers.forEach((users, roomId) => {
        if (users.has(socket.id)) {
          users.delete(socket.id)
          io.to(roomId).emit('room-users', users.size)
          if (users.size === 0) handleRoomEmpty(roomId)
        }
      })
      if (dev) console.log(`[Socket.io] Client disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
