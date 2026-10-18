# Plano 07 — Centro de despacho e controlo ao vivo

## Planning header

- Goal: Centro de despacho e controlo ao vivo.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Fazer da Operação Live uma ferramenta de ação e não apenas um mapa/lista. O sistema já distribui ofertas automaticamente e mostra corridas/motoristas online; as rotas administrativas atualmente identificadas são sobretudo de consulta, sem comandos de atribuição manual, reatribuição e escalonamento expostos no painel.

## Arquitetura proposta
Criar uma máquina de despacho auditável com estados de fila, oferta, aceite, timeout e escalonamento. O operador vê proximidade por tempo estimado, estado da localização, categoria e elegibilidade. A decisão manual só pode usar motoristas elegíveis e deve respeitar transições concorrentes; o serviço de despacho continua sendo a autoridade.

## Fases
1. Definir SLA por tipo de serviço e política de quem pode reatribuir/cancelar, com motivos e limites.
2. Criar endpoint de fila de não atribuídas e resumo por idade; adicionar comando transacional de atribuir/retirar/reofertar com idempotência.
3. Construir no painel filtros de urgência, estado de localização, motorista elegível e motivo do atraso; preservar o mapa e navegação visual atual.
4. Registar cada tentativa/oferta/aceite/falha, evitar duas atribuições simultâneas e reconciliar eventos em tempo real com polling de recuperação.
5. Criar alertas de SLA e ações rápidas com confirmação proporcional ao risco.
6. Validar tempestade de eventos, localização obsoleta, motorista offline, corrida aceite ao mesmo tempo e recuperação pós-restart.

## Critérios de aceitação
- Nunca há dois motoristas atribuídos à mesma corrida.
- Operador vê por que cada candidato é elegível ou excluído.
- Toda intervenção humana tem ator, motivo, antes/depois e timestamp.
- Corrida sem localização recente não é apresentada como motorista ao vivo.
- A tela recupera estado correto após perder WebSocket.

## Dependências, riscos e validação
Depende de RBAC, veículo, compliance e contrato de localização. Começar com recomendações explicáveis e ações manuais; não introduzir atribuição automática baseada só em distância em linha reta.


