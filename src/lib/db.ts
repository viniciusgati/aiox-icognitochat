import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'icognitochat.db')

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

  CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
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

// Seed: sala "Geral" sempre presente
db.prepare(`
  INSERT OR IGNORE INTO rooms (slug, name, description, is_private)
  VALUES ('general', 'Geral', 'Sala de chat geral', 0)
`).run()

export default db

/** Delete an ephemeral room from the database by slug. */
export function deleteRoom(slug: string): void {
  db.prepare('DELETE FROM rooms WHERE slug = ?').run(slug)
}

/**
 * Overwrite the SQLite database file with zeros and delete it.
 * Called on server SIGTERM/SIGINT for privacy-conscious shutdown.
 */
export function zeroizeDb(): void {
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
