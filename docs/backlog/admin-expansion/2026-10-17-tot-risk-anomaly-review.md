# Plano 16 — Deteção explicável de abuso e anomalias

## Planning header

- Goal: Deteção explicável de abuso e anomalias.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e inovação
Encontrar padrões que causam perda ou fraude sem bloquear pessoas por um algoritmo opaco. Casos potenciais: muitas contas/dispositivos, repetição de cancelamento, localização impossível, discrepância de pagamento, pedidos duplicados e uso fora da política.

## Arquitetura proposta
Começar com regras determinísticas e score de risco explicável, eventos de alerta e fila de revisão. Não guardar impressão digital invasiva sem necessidade e não usar apenas uma regra para suspender alguém. O resultado sugere investigação; ação final é humana e auditada.

## Fases
1. Mapear abuso observado, falsos positivos e políticas de contestação com operação/suporte.
2. Instrumentar eventos mínimos com timestamps, origem, ator e idempotência; mascarar identificadores quando possível.
3. Construir regras em modo sombra (só medem, não bloqueiam) e comparar alertas com casos confirmados.
4. Criar painel de revisão com explicação das regras, evidências relacionadas e decisão/motivo.
5. Habilitar medidas graduais e reversíveis, como pedir confirmação adicional ou limitar uma ação, com regra e permissão.
6. Reavaliar precisão, viés por zona/dispositivo e tempo de retenção; interromper regras com falso positivo alto.

## Critérios de aceitação
- Cada alerta mostra regra, dados considerados e janela temporal.
- Score não decide sozinho suspensão, cancelamento financeiro ou acusação.
- Decisão, revisão e contestação são registadas.
- Dados de risco têm acesso restrito e retenção limitada.
- Alertas repetidos são deduplicados e não inundam operadores.

## Dependências, riscos e validação
Depende de suporte, RBAC, ledger e analytics. Iniciar após haver base real rotulada; antes disso o modelo não tem evidência confiável. Não chamar automaticamente um padrão de fraude.


