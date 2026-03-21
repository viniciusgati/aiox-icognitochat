# IcognitoChat — Arquitetura do Sistema

## Visão Geral

Chat privado com criptografia de ponta a ponta, gerenciado por senha mestra, sem dependências externas de auth. Funciona como PWA — instalável em mobile via browser, sem app stores.

---

## Stack Tecnológico

| Camada | Tecnologia | Motivo |
|--------|-----------|--------|
| Frontend | Next.js 14 (App Router) | Full-stack, PWA, simples |
| PWA | next-pwa + manifest.json | Instalável no mobile sem stores |
| Realtime | Socket.io | WebSocket com fallback automático |
| Banco | SQLite (better-sqlite3) | Arquivo único, fácil de apagar/sobrescrever |
| Criptografia | Web Crypto API (nativa) | AES-256-GCM, sem libs externas |
| Hashing | bcryptjs | Hash da senha mestra e senhas de usuários |
| Estilo | Tailwind CSS | Rápido, sem configuração complexa |

---

## Arquitetura de Segurança

### Criptografia E2E

```
Remetente:
  1. Deriva chave simétrica da sala (AES-256-GCM) via PBKDF2
  2. Criptografa mensagem com chave da sala + IV aleatório
  3. Envia {ciphertext, iv} via WebSocket

Destinatário:
  1. Recebe {ciphertext, iv}
  2. Usa a mesma chave da sala para descriptografar
  3. Exibe mensagem em plain text
```

### Gerenciamento de Usuários via Senha Mestra
```
Admin:
  1. Define MASTER_PASSWORD no .env ao iniciar o servidor
  2. Acessa /admin (protegido pela senha mestra)
  3. Gera par {username, password} aleatório para um amigo
  4. Compartilha as credenciais fora do sistema
```

### Limpeza de Dados no Fechamento
```
Browser:
  - beforeunload: limpa todas as chaves de sessão da memória
  - Mensagens NÃO são salvas no localStorage (apenas na memória)

Servidor:
  - Mensagens ficam apenas em memória (SQLite em modo :memory: opcional)
  - Ao reiniciar servidor: mensagens são perdidas
  - Arquivo SQLite (se usado): sobrescrito com zeros ao encerrar (graceful shutdown)
```

---

## Estrutura de Dados

### Users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);
```

### Rooms
```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Messages (apenas em memória — não persistido em arquivo)
```
Estrutura em memória:
{
  roomId: string,
  userId: string,
  username: string,
  ciphertext: string,    -- mensagem criptografada
  iv: string,            -- vetor de inicialização
  timestamp: number
}
```

---

## Fluxo de Telas

```
/ (Login)
  ↓ autenticado
/chat (Hub)
  ├── Chat Geral (sala "general" — sempre existe)
  └── [Lista de Salas]
        ├── Entrar em sala existente
        └── + Criar nova sala
              ↓
        /chat/[roomId] (Chat da Sala)
```

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── page.tsx              # Login (home)
│   ├── chat/
│   │   ├── page.tsx          # Hub: lista de salas
│   │   └── [roomId]/
│   │       └── page.tsx      # Chat de uma sala
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── admin/route.ts  # Criar usuários (requer master pw)
│       └── rooms/route.ts
├── components/
│   ├── LoginForm.tsx
│   ├── RoomList.tsx
│   ├── ChatWindow.tsx
│   └── CreateRoomModal.tsx
├── lib/
│   ├── crypto.ts             # Web Crypto API: encrypt/decrypt
│   ├── db.ts                 # SQLite: users e rooms
│   ├── session.ts            # JWT session (iron-session)
│   └── socket-client.ts      # Socket.io client
├── server/
│   └── socket.ts             # Socket.io server (custom server)
public/
├── manifest.json             # PWA manifest
└── sw.js                     # Service Worker (gerado pelo next-pwa)
```

---

## Decisões de Design

1. **Sem banco de mensagens** — mensagens ficam apenas em memória do servidor. Ao reiniciar, histórico some. Isso é intencional — privacidade máxima.
2. **Senha da sala = chave de criptografia** — ao criar/entrar em uma sala, o nome da sala deriva a chave AES via PBKDF2. Simples e sem troca de chaves complexa.
3. **Session via JWT** — iron-session (cookie httpOnly, signed). Sem banco de sessões.
4. **PWA** — manifest + service worker via next-pwa. Instalável no Android e iOS via "Adicionar à tela inicial".
5. **SQLite para users/rooms** — apenas metadados. Mensagens NUNCA persistidas em disco.
