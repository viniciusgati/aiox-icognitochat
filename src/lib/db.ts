import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'icognitochat.db')
const DATA_DIR = path.dirname(DB_PATH)
export const IMAGES_DIR = path.join(DATA_DIR, 'images')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Run initial migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_private INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS room_images (
    id TEXT PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_room_images_room_id ON room_images(room_id);
`)

// Migration: add slug column to existing rooms table if not present
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN slug TEXT UNIQUE`)
} catch {
  // Column already exists — ignore
}

// Migration: add is_ephemeral column if not present
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN is_ephemeral INTEGER NOT NULL DEFAULT 0`)
} catch {
  // Column already exists — ignore
}

// Migration: add message_ttl_seconds column if not present
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN message_ttl_seconds INTEGER`)
} catch {
  // Column already exists — ignore
}

// Migration: add is_admin column to users if not present
try {
  db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`)
} catch {
  // Column already exists — ignore
}

// Migration: add push_subscriptions table if not present
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);
`)

// Migration: add global_settings table if not present
db.exec(`
  CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// Seed default settings
const settingsDefaults: Record<string, string> = {
  allow_room_creation: '1',
  admin_only_chat: '0',
}
for (const [key, value] of Object.entries(settingsDefaults)) {
  db.prepare('INSERT OR IGNORE INTO global_settings (key, value) VALUES (?, ?)').run(key, value)
}

// Seed: sala "Geral" sempre presente
db.prepare(`
  INSERT OR IGNORE INTO rooms (slug, name, description, is_private)
  VALUES ('general', 'Geral', 'Sala de chat geral', 0)
`).run()

export default db

/** Read a global setting by key. Returns null if not found. */
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM global_settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

/** Write a global setting. */
export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)').run(key, value)
}

/** Delete image files for a room from disk. Returns number of deleted files. */
export function deleteRoomImages(slug: string): number {
  const room = db.prepare('SELECT id FROM rooms WHERE slug = ?').get(slug) as { id: number } | undefined
  if (!room) return 0
  const images = db
    .prepare('SELECT id FROM room_images WHERE room_id = ?')
    .all(room.id) as { id: string }[]
  let deleted = 0
  for (const img of images) {
    try {
      fs.unlinkSync(path.join(IMAGES_DIR, `${img.id}.bin`))
      deleted++
    } catch {
      // File may not exist — ignore
    }
  }
  return deleted
}

/** Delete an ephemeral room from the database by slug (also cleans image files). */
export function deleteRoom(slug: string): void {
  deleteRoomImages(slug)
  db.prepare('DELETE FROM rooms WHERE slug = ?').run(slug)
}

/** Delete all ephemeral rooms on server startup (orphans from crashes/deploys). */
export function cleanOrphanedEphemeralRooms(): number {
  const result = db.prepare('DELETE FROM rooms WHERE is_ephemeral = 1').run()
  return result.changes
}

/** Delete image files older than ttlHours from disk and DB. Returns number deleted. */
export function deleteExpiredImages(ttlHours: number): number {
  const expired = db
    .prepare('SELECT id FROM room_images WHERE created_at < unixepoch() - (? * 3600)')
    .all(ttlHours) as { id: string }[]
  let deleted = 0
  for (const img of expired) {
    try {
      fs.unlinkSync(path.join(IMAGES_DIR, `${img.id}.bin`))
      deleted++
    } catch {
      // File may already be gone — ignore
    }
  }
  if (expired.length > 0) {
    db.prepare('DELETE FROM room_images WHERE created_at < unixepoch() - (? * 3600)').run(ttlHours)
  }
  return deleted
}

/** Delete messages older than ttlHours. Returns number of deleted rows. */
export function deleteExpiredMessages(ttlHours: number): number {
  const result = db
    .prepare('DELETE FROM messages WHERE created_at < unixepoch() - (? * 3600)')
    .run(ttlHours)
  return result.changes
}

/**
 * Delete ALL data (users, rooms, messages) in a single transaction.
 * The database file is preserved — the server keeps running with empty tables.
 * Returns the number of deleted rows per table.
 */
export function destroyAllData(): { users: number; rooms: number } {
  return db.transaction(() => {
    db.prepare('DELETE FROM messages').run()
    const rooms = db.prepare('DELETE FROM rooms').run()
    const users = db.prepare('DELETE FROM users').run()
    return { users: users.changes, rooms: rooms.changes }
  })()
}

/**
 * Overwrite the SQLite database file with zeros and delete it.
 *
 * ⚠️  DESTRUIÇÃO PERMANENTE: apaga todos os usuários, salas e dados do banco.
 * Se DB_PATH apontar para um Railway Volume, os dados persistentes serão
 * irrecuperáveis. NÃO chamar em produção sem intenção explícita.
 *
 * Bloqueado em NODE_ENV=production como salvaguarda.
 */
export function zeroizeDb(): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[zeroizeDb] Chamada bloqueada em produção — operação cancelada.')
    return
  }
  try {
    db.close()
    const size = fs.statSync(DB_PATH).size
    const zeros = Buffer.alloc(size, 0)
    fs.writeFileSync(DB_PATH, zeros)
    fs.unlinkSync(DB_PATH)
  } catch {
    // Best-effort: ignore errors during shutdown
  }
}
