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
5. **Produção:** os backups **automatizados e monitorados** de
   produção são pendência registrada (L8 em
   [`../docs/akylla/CHECKLIST_PRE_PRODUCAO.md`](../docs/akylla/CHECKLIST_PRE_PRODUCAO.md));
   esta pasta é só o procedimento manual local.

## Por que existe

- O projeto tem **nenhum backup automatizado com restore testado**
  (limitação L8, severidade alta) — esta pasta estrutura o hábito
  manual enquanto o agendamento de produção não é definido.
- Dá um ponto de restauração antes de operações de risco (migrations
  manuais, `db:reset`, upgrade de versão do Postgres).
