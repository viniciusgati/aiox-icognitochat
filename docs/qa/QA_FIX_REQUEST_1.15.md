# QA Fix Request — Story 1.15

**Data:** 2026-03-21
**QA:** Quinn (@qa)
**Para:** Dex (@dev)
**Story:** 1.15 — Painel Admin de Gerenciamento de Usuários

---

## Fix Requerido

### [HIGH] FK Constraint — Deleção de usuário falha se houver mensagens

**Arquivo:** `src/app/api/auth/admin/users/[id]/route.ts`
**Linha:** 26

**Problema:**

```ts
db.prepare('DELETE FROM users WHERE id = ?').run(id)
```

Com `foreign_keys = ON` (ativo em `db.ts`), esse DELETE falha com `FOREIGN KEY constraint failed` quando o usuário possui mensagens. A tabela `messages` declara `user_id REFERENCES users(id)` sem `ON DELETE CASCADE`.

Resultado: a UI recebe HTTP 500 silencioso, o usuário não é removido, mas nenhum feedback adequado é exibido.

**Fix:**

Deletar as mensagens do usuário **antes** de deletar o usuário:

```ts
// Antes de: db.prepare('DELETE FROM users WHERE id = ?').run(id)
db.prepare('DELETE FROM messages WHERE user_id = ?').run(id)
db.prepare('DELETE FROM users WHERE id = ?').run(id)
```

**Arquivo a modificar:** `src/app/api/auth/admin/users/[id]/route.ts`

---

## Critério de Conclusão

- [ ] `DELETE FROM messages WHERE user_id = ?` executado antes do `DELETE FROM users`
- [ ] Deleção de usuário com mensagens retorna `{ ok: true }` sem erro 500
- [ ] Deleção de usuário sem mensagens continua funcionando normalmente
