# Plano 17 — Viagens agendadas e contas empresariais

## Planning header

- Goal: Viagens agendadas e contas empresariais.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e oportunidade
Permitir corridas/entregas futuras e clientes empresariais com controlo de custo, centros de custo e relatórios. É um canal de receita B2B, mas exige disponibilidade previsível, suporte e fluxo financeiro robusto; não deve ser construído antes de estabilizar operação on-demand.

## Arquitetura proposta
Separar reserva futura de viagem já despachada. Reserva tem janela, fuso, estado, dados de faturação e regra de cancelamento; despacho ocorre perto do horário com capacidade confirmada. Conta empresarial inclui membros, aprovadores, limites e centro de custo. Não assumir faturação a crédito sem análise de risco.

## Fases
1. Validar procura B2B e compromissos operacionais (horário, atraso, substituição, atendimento).
2. Modelar empresas, membros, centros de custo, limites e reservas; separar aceite da reserva de atribuição de motorista.
3. Criar painel para gerir contas e reservas, regras de aprovação, histórico e exportação por departamento.
4. Criar jornada nos apps para solicitar, alterar/cancelar e acompanhar; notificar mudanças e atraso.
5. Ativar cobrança empresarial apenas depois do ledger, reconciliação, documento fiscal e política de crédito.
6. Pilotar com 1-2 contas, limites e atendimento dedicados; medir pontualidade, cancelamento e margem.

## Critérios de aceitação
- Reserva futura nunca aparece como motorista confirmado antes da atribuição.
- Política de alteração/cancelamento e timezone está clara.
- Gasto respeita limites e regista aprovador/centro de custo.
- Falta de oferta ativa escalonamento e aviso com antecedência.
- Crédito/fatura empresarial não está disponível sem política e documento fiscal definidos.

## Dependências, riscos e validação
Depende de RBAC, despacho, ledger, suporte e faturação. Começar com piloto fechado; não exibir como serviço garantido até medir capacidade real por zona/turno.


