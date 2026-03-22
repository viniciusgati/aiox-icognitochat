import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { deleteRoom, cleanOrphanedEphemeralRooms, deleteExpiredMessages, deleteExpiredImages } from '@/lib/db'
import logger from '@/lib/logger'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Server shutting down')
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
  ;(global as any).io = io

  // Presence tracking: roomId → Map<socketId, username>
  const roomUsers = new Map<string, Map<string, string>>()
  // User socket tracking: username → Set<socketId> (for force-logout)
  const userSockets = new Map<string, Set<string>>()
  ;(global as any).userSockets = userSockets
  // Ephemeral rooms: deleted from DB when last user leaves
  const ephemeralRooms = new Set<string>()
  // Owner tracking for ephemeral rooms: roomId → socketId
  const roomOwners = new Map<string, string>()
  // Reactions: msgId → emoji → Set<socketId> (in-memory, ephemeral)
  const messageReactions = new Map<string, Map<string, Set<string>>>()
  // Max participants per room: roomId → maxParticipants
  const roomMaxParticipants = new Map<string, number>()

  function handleRoomEmpty(roomId: string) {
    if (ephemeralRooms.has(roomId)) {
      deleteRoom(roomId)
      ephemeralRooms.delete(roomId)
      roomUsers.delete(roomId)
      roomOwners.delete(roomId)
      roomMaxParticipants.delete(roomId)
      logger.debug({ roomId }, 'Ephemeral room deleted')
    }
  }

  function promoteNewOwner(roomId: string, leavingSocketId: string) {
    if (roomOwners.get(roomId) !== leavingSocketId) return
    roomOwners.delete(roomId)
    const nextSocketId = roomUsers.get(roomId)?.keys().next().value
    if (nextSocketId) {
      roomOwners.set(roomId, nextSocketId)
      io.to(nextSocketId).emit('room-owner', true)
      logger.debug({ roomId, nextSocketId }, 'New owner promoted')
    }
  }

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Client connected')

    socket.on(
      'join-room',
      ({
        roomId,
        username,
        ephemeral,
        maxParticipants,
      }: {
        roomId: string
        username: string
        ephemeral?: boolean
        maxParticipants?: number
      }) => {
        // Store max participants when first set (by creator)
        if (maxParticipants && maxParticipants >= 2 && !roomMaxParticipants.has(roomId)) {
          roomMaxParticipants.set(roomId, maxParticipants)
        }

        // Enforce participant limit (owner/creator always allowed)
        const currentCount = roomUsers.get(roomId)?.size ?? 0
        const max = roomMaxParticipants.get(roomId)
        const isOwnerJoining = !roomOwners.has(roomId) // first to join = future owner
        if (max && currentCount >= max && !isOwnerJoining) {
          socket.emit('join-denied')
          logger.info({ roomId, username, max, currentCount }, 'Join denied: room full')
          return
        }

        socket.join(roomId)
        if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map())
        roomUsers.get(roomId)!.set(socket.id, username)
        if (!userSockets.has(username)) userSockets.set(username, new Set())
        userSockets.get(username)!.add(socket.id)
        if (ephemeral) ephemeralRooms.add(roomId)

        // First to join an ephemeral room becomes owner
        if (ephemeral && !roomOwners.has(roomId)) {
          roomOwners.set(roomId, socket.id)
          socket.emit('room-owner', true)
          logger.debug({ roomId, socketId: socket.id }, 'Owner set for ephemeral room')
        }

        const count = roomUsers.get(roomId)!.size
        io.to(roomId).emit('room-users', count)
        io.to(roomId).emit('room-users-list', Array.from(roomUsers.get(roomId)!.values()))
        logger.debug({ username, roomId, ephemeral: !!ephemeral, count }, 'User joined room')
      }
    )

    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId)
      roomUsers.get(roomId)?.delete(socket.id)
      promoteNewOwner(roomId, socket.id)
      const count = roomUsers.get(roomId)?.size ?? 0
      io.to(roomId).emit('room-users', count)
      io.to(roomId).emit('room-users-list', Array.from(roomUsers.get(roomId)?.values() ?? []))
      if (count === 0) handleRoomEmpty(roomId)
    })

    socket.on(
      'kick-user',
      ({ roomId, targetUsername }: { roomId: string; targetUsername: string }) => {
        if (roomOwners.get(roomId) !== socket.id) return
        const users = roomUsers.get(roomId)
        const targetSocketId = [...(users?.entries() ?? [])].find(
          ([, u]) => u === targetUsername
        )?.[0]
        if (targetSocketId) {
          io.to(targetSocketId).emit('kicked')
          io.sockets.sockets.get(targetSocketId)?.leave(roomId)
          users?.delete(targetSocketId)
          const count = users?.size ?? 0
          io.to(roomId).emit('room-users', count)
          io.to(roomId).emit('room-users-list', Array.from(users?.values() ?? []))
          logger.info({ roomId, targetUsername }, 'User kicked from room')
        }
      }
    )

    socket.on('close-room', ({ roomId }: { roomId: string }) => {
      if (roomOwners.get(roomId) !== socket.id) return
      io.to(roomId).emit('room-closed')
      deleteRoom(roomId)
      roomOwners.delete(roomId)
      roomUsers.delete(roomId)
      ephemeralRooms.delete(roomId)
      roomMaxParticipants.delete(roomId)
      logger.info({ roomId }, 'Ephemeral room closed by owner')
    })

    socket.on(
      'typing-start',
      ({ roomId, username }: { roomId: string; username: string }) => {
        socket.to(roomId).emit('user-typing', { username })
      }
    )

    socket.on(
      'typing-stop',
      ({ roomId, username }: { roomId: string; username: string }) => {
        socket.to(roomId).emit('user-stopped-typing', { username })
      }
    )

    socket.on(
      'send-message',
      (data: {
        roomId: string
        ciphertext: string
        iv: string
        username: string
        timestamp: number
        msgId: string
        replyTo?: { id: string; username: string; content: string }
      }) => {
        // Relay encrypted payload — server never reads plaintext
        socket.to(data.roomId).emit('receive-message', {
          ciphertext: data.ciphertext,
          iv: data.iv,
          username: data.username,
          timestamp: data.timestamp,
          msgId: data.msgId,
          replyTo: data.replyTo,
        })
      }
    )

    socket.on(
      'send-image',
      (data: {
        roomId: string
        imageId: string
        iv: string
        username: string
        timestamp: number
        msgId: string
      }) => {
        // Relay encrypted image reference — server never sees plaintext
        socket.to(data.roomId).emit('receive-image', {
          imageId: data.imageId,
          iv: data.iv,
          username: data.username,
          timestamp: data.timestamp,
          msgId: data.msgId,
        })
      }
    )

    socket.on(
      'react-to-message',
      ({ roomId, messageId, emoji }: { roomId: string; messageId: string; emoji: string }) => {
        const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '🔥', '👏'])
        if (!ALLOWED_EMOJIS.has(emoji)) return

        if (!messageReactions.has(messageId)) {
          messageReactions.set(messageId, new Map())
        }
        const emojiMap = messageReactions.get(messageId)!
        if (!emojiMap.has(emoji)) emojiMap.set(emoji, new Set())
        const reactors = emojiMap.get(emoji)!

        // Toggle: second click removes reaction
        if (reactors.has(socket.id)) {
          reactors.delete(socket.id)
        } else {
          reactors.add(socket.id)
        }

        // Build counts object and broadcast to room
        const counts: Record<string, number> = {}
        emojiMap.forEach((set, e) => { if (set.size > 0) counts[e] = set.size })
        io.to(roomId).emit('reaction-updated', { messageId, counts })

        // Tell this socket which emojis they've personally reacted to
        const myReactions: string[] = []
        emojiMap.forEach((set, e) => { if (set.has(socket.id)) myReactions.push(e) })
        socket.emit('my-reaction-state', { messageId, myReactions })
      }
    )

    socket.on('disconnect', () => {
      // Remove from all tracked rooms on unexpected disconnect
      roomUsers.forEach((users, roomId) => {
        if (users.has(socket.id)) {
          users.delete(socket.id)
          promoteNewOwner(roomId, socket.id)
          io.to(roomId).emit('room-users', users.size)
          io.to(roomId).emit('room-users-list', Array.from(users.values()))
          if (users.size === 0) handleRoomEmpty(roomId)
        }
      })
      // Clean up userSockets tracking
      userSockets.forEach((socketIds, username) => {
        socketIds.delete(socket.id)
        if (socketIds.size === 0) userSockets.delete(username)
      })
      logger.debug({ socketId: socket.id }, 'Client disconnected')
    })
  })

  const cleaned = cleanOrphanedEphemeralRooms()
  logger.info({ cleaned }, 'Cleaned orphaned ephemeral rooms')

  const ttlHours = parseInt(process.env.MESSAGE_TTL_HOURS ?? '24', 10)
  if (ttlHours > 0) {
    const deletedOnStartup = deleteExpiredMessages(ttlHours)
    logger.info({ deleted: deletedOnStartup, ttlHours }, 'TTL cleanup on startup')
    setInterval(() => {
      const deleted = deleteExpiredMessages(ttlHours)
      logger.info({ deleted, ttlHours }, 'TTL cleanup')
    }, 60 * 60 * 1000)
  }

  const imageTtlHours = parseInt(process.env.IMAGE_TTL_HOURS ?? '48', 10)
  if (imageTtlHours > 0) {
    const deletedOnStartup = deleteExpiredImages(imageTtlHours)
    logger.info({ deleted: deletedOnStartup, imageTtlHours }, 'Image TTL cleanup on startup')
    setInterval(() => {
      const deleted = deleteExpiredImages(imageTtlHours)
      logger.info({ deleted, imageTtlHours }, 'Image TTL cleanup')
    }, 3 * 60 * 60 * 1000)
  }

  httpServer.listen(port, () => {
    logger.info({ hostname, port }, 'Server ready')
  })
})
