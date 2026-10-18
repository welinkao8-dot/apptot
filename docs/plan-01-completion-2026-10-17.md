# Relatório de conclusão técnica — Plano 01 — 2026-10-17

## Entregas

- Validei as 11 migrations num PostgreSQL 15 descartável, incluindo dois `prisma migrate deploy` concorrentes, backfill válido e rollback transacional que preserva as colunas/dados antigos quando um documento legado é inválido.
- Migrei documentos de motorista para a tabela privada `driver_documents`, com validação real de JPEG/PNG/WebP, limite de 8 MiB por arquivo, endpoint autenticado para revisão, ciclo de substituição/retenção, legal hold e purga serializada por advisory lock.
- Ampliei o harness de integração para cobrir o ciclo completo de entrega, tarifa imutável depois da atualização do serviço, retry de quote, uma viagem ativa por cliente, aceitação concorrente, cancelamento versus início/aceitação, conclusão idempotente, pagamento em numerário, fatura e auditoria.
- Endureci validação de preços/serviços, autosuggest, UUID no endpoint interno de estado do motorista, ownership do pagamento do motorista e rejeição de documentos com assinatura falsa antes de abrir transação.
- Quotes parciais preservam o formato de array consumido pelo mobile e incluem `unavailableServices`, sem expor mensagens ou credenciais da HERE.
- Arquivei os servidores Express antigos em `archive/legacy-backends/` depois de confirmar que Compose/deploy usa NestJS e que não há callers ativos. Atualizei o README local para refletir as três APIs Nest.
- Registei a matriz de contratos e evidências em `docs/plan-01-api-contract-validation-2026-10-17.md`.

## Verificação

- Backend unitário: 42 suites, 409 testes aprovados.
- E2E: Admin 25/25, Client 35/35, Driver 24/24.
- Harness `npm run test:plan01:postgres`: aprovado em PostgreSQL 15 descartável.
- Builds Nest: admin-api, client-api, driver-api aprovados.
- Mobile quote selection: 10/10.
- `git diff --check`: sem erros de whitespace; Git mostrou apenas avisos de conversão LF/CRLF em arquivos já alterados no workspace.

## Fora do ambiente de produção

`DRIVER_DOCUMENT_RETENTION_DAYS` continua sem valor porque nenhum prazo foi definido/aprovado. Sem essa configuração, a purga automática não apaga documentos; legal hold permanece respeitado. Definir esse valor antes de ativar a retenção em produção.

Nenhuma migration foi aplicada no Coolify. Não fiz APK, deploy, nem teste no telefone.

## Nota de limpeza local

O harness deixou diretórios temporários de execuções interrompidas anteriores em `backend-monorepo/.plan01-postgres-validation*`. A remoção recursiva foi rejeitada pela revisão automática de segurança; acrescentei-os ao `.gitignore`, confirmei com `git check-ignore` e removi o container PostgreSQL de teste parado. Assim esses diretórios locais não entram no commit/push.
