# Plano 19 — Saúde do sistema e integrações no painel

## Planning header

- Goal: Saúde do sistema e integrações no painel.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e inovação
Dar visibilidade prática a falhas antes que clientes liguem: APIs, base de dados, HERE, FCM, armazenamento de anexos, fila de notificações e falhas de build/deploy quando a integração estiver disponível. O painel atual oferece operação de viagens, mas não um estado central de dependências e jobs.

## Arquitetura proposta
Criar health/status agregados sem segredos, métricas de latência/erro, eventos de fila e alertas. Os health checks separados indicam prontidão técnica; a vista admin mostra disponibilidade recente e impacto funcional. Não expor infraestrutura privada para contas sem permissão.

## Fases
1. Definir componentes e indicadores: disponibilidade, erro, latência, último sucesso, idade da fila e quantidade acumulada.
2. Padronizar health/readiness e instrumentação com identificador de correlação, sem PII em logs.
3. Ligar eventos de falha de mapas, push, pagamentos, uploads e jobs; alertar por degradação e não por uma falha isolada.
4. Criar painel de estado com período, detalhe sanitizado e runbook; separar saúde do serviço de sucesso da operação.
5. Criar deduplicação, reconhecimento, escalonamento e teste de recuperação.
6. Validar queda/restart do serviço, banco indisponível, provedor lento, fila acumulada e falso alerta.

## Critérios de aceitação
- Dashboard não apresenta dependência como operacional sem probe recente.
- Falhas possuem timestamp, impacto e instrução de ação, sem stack trace/secret público.
- Alertas degradados recuperam estado automaticamente após estabilização.
- Health endpoint não substitui monitoração externa nem divulga dados internos.
- Métrica de erro permite relacionar request/job sem guardar dados de passageiro.

## Dependências, riscos e validação
Depende de instrumentação das APIs e RBAC; não depende de mudança no provedor de deploy. O painel complementa logs e monitorização do servidor, não os substitui.


