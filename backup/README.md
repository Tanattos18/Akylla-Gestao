# `backup/` — cópias de segurança locais

**Papel desta pasta:** guardar cópias de segurança **fora do Git** geradas
em ambiente local/de trabalho. Não é parte do build, do lint nem dos
testes.

## O que guardar aqui

| Arquivo típico | Origem | Comando |
|---|---|---|
| `petflow_YYYYMMDD_HHMM.sql` | banco de desenvolvimento | `npm run db -- backup` (ver abaixo) |
| `petflow_test_YYYYMMDD.sql` | banco de teste | `pg_dump` manual |
| `docs_YYYYMMDD.tar.gz` | snapshot de `docs/` | `tar -czf backup/docs_$(date +%Y%m%d).tar.gz docs/` |
| `.env.local_YYYYMMDD` | configuração de ambiente | cópia manual, só do **seu** ambiente |

### Exemplo de dump do banco

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges \
  -f "backup/petflow_$(date +%Y%m%d_%H%M).sql"
```

### Exemplo de restauração (drill)

```bash
psql "$DATABASE_URL" -f backup/petflow_YYYYMMDD_HHMM.sql
npm run db:validate
npm test
```

## Backup automatizado com restore testado (Fase 1 · `scripts/db-backup.mjs`)

| Comando | O que faz |
|---|---|
| `npm run db:backup` | `pg_dump --format=custom --compress=6` → `akylla_YYYY-MM-DD_HHmm.dump`, aplica a retenção e **restaura em banco efêmero** para validar |
| `npm run db:backup -- --retain=7` | retenção em dias (padrão `RETENTION_DAYS` ou 30) |
| `npm run db:backup -- --skip-verify` | só o dump, sem o restore de teste |
| `npm run db:restore-test [-- <arquivo>]` | só o teste de restore (padrão: dump mais recente) |
| `npm run db:restore -- <arquivo>` | restaura um dump no banco de `DATABASE_URL` (**destrutivo** — confira o alvo) |

**Validação do restore** (o backup só "passa" se tudo bater): o dump é
restaurado em `akylla_restore_test` (`RESTORE_TEST_DB`), e o script
confere (1) a contagem de linhas de **todas** as tabelas igual à origem,
(2) o mesmo número de migrations aplicadas e (3) `prisma migrate diff`
sem diferenças entre o banco restaurado e o `schema.prisma`. O banco
efêmero é removido sempre, com sucesso ou falha. Log em
`<BACKUP_DIR>/backup.log`; exit code ≠ 0 em qualquer falha (o
agendador deve alertar nesse caso).

**Segurança:** a senha do banco nunca vai na linha de comando nem no log
(é passada por `PGPASSWORD`). Requisitos: `pg_dump`, `pg_restore`,
`psql`, `createdb` e `dropdb` da **mesma versão major do servidor**
(no PATH, em `PG_BIN` ou, no Windows, detectados em
`C:\Program Files\PostgreSQL\<versão>\bin`).

### Agendamento em produção

```cron
# diário às 02:00 (horário do servidor); falha ⇒ exit ≠ 0 ⇒ alerta
0 2 * * * cd /srv/akylla && npm run db:backup >> /var/log/akylla-backup.log 2>&1 || /srv/akylla/bin/alerta-backup.sh
```

No Windows (Agendador de Tarefas): ação `npm run db:backup` com
"Iniciar em" na raiz do repositório, gatilho diário às 02:00.

### Anexos (Fase 2 · 2.3)

Fotos e laudos das ordens de serviço ficam **no disco**, em `UPLOADS_DIR`
(padrão `./uploads`), e **não** estão no dump do banco. Copie essa pasta
junto com o dump, no mesmo horário, para o mesmo destino externo (ex.:
`rclone copy uploads/ b2:akylla-backups/uploads`). Na restauração, volte
os dois do mesmo dia: o banco guarda só o caminho relativo de cada anexo.

### Política

| Item | Valor |
|---|---|
| Frequência | diária (02:00) |
| Retenção local | 30 dias (`RETENTION_DAYS`) |
| Cópia fora do servidor (offsite) | obrigatória em produção: enviar cada dump para bucket S3/Backblaze B2 com criptografia e versionamento (ex.: `rclone copy backup/ b2:akylla-backups`), retenção ≥ 30 dias |
| **RPO** (perda máxima de dados) | ≤ 24 h |
| **RTO** (tempo máximo para voltar) | ≤ 4 h |
| Drill | o próprio `db:backup` testa o restore a cada execução; ensaio manual completo (restaurar em ambiente novo + `npm run validate`) 1×/mês |

Se o provedor de banco gerenciado já oferecer backup com PITR, mantenha
o `db:backup` como segunda cópia independente (e offsite).

**Teste automatizado:** `tests/integration/backup.test.ts` roda o script
real contra o banco de teste (dump, restore validado, retenção, dump
corrompido, ausência de senha no log). É pulado com aviso quando os
binários do PostgreSQL não estão disponíveis na versão do servidor.

## Regras obrigatórias

1. **Nada sensível vai para o Git.** Todo o conteúdo de `backup/` é
   ignorado pelo `.gitignore` (apenas este `README.md` é versionado).
   Isso cobre dumps de banco, `.env` copiado, planilhas de clientes
   e quaisquer dados pessoais.
2. **Nunca commite** senhas, tokens, `DATABASE_URL` real ou dados de
   clientes reais — regra 6 do `AGENTS.md`.
3. **Drill obrigatório:** um backup só conta se já foi **restaurado**
   com sucesso ao menos uma vez. Restaurar em ambiente local e rodar
   `npm run validate`.
4. **Retenção:** apague dumps com mais de 30 dias. Não é arquivo
   histórico — o histórico é o Git.
5. **Produção:** o script automatizado existe (seção acima); falta
   agendá-lo no servidor de produção, configurar a cópia offsite e o
   alerta de falha (L8 em
   [`../docs/akylla/CHECKLIST_PRE_PRODUCAO.md`](../docs/akylla/CHECKLIST_PRE_PRODUCAO.md)).

## Por que existe

- O projeto tem **nenhum backup automatizado com restore testado**
  (limitação L8, severidade alta) — esta pasta estrutura o hábito
  manual enquanto o agendamento de produção não é definido.
- Dá um ponto de restauração antes de operações de risco (migrations
  manuais, `db:reset`, upgrade de versão do Postgres).
