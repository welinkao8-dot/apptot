# Plano 05 — Métodos de pagamento, reconciliação e reembolsos

## Planning header

- Goal: Métodos de pagamento, reconciliação e reembolsos.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Suportar mais que numerário sem declarar pagamentos digitais que não existem. Hoje o método operacional confirmado é cash, com um pagamento por viagem e confirmação pelo motorista. Não há evidência de integração ativa com PSP, webhooks financeiros, reembolso, disputa ou payout automático.

## Arquitetura proposta
Manter uma abstração de provedor, mas escolher o PSP apenas depois de confirmar disponibilidade em Angola, moeda, custos e liquidação. Separar intenção, tentativa, evento externo, pagamento liquidado, reembolso e chargeback. Validar assinatura dos webhooks, idempotência, estado monotónico e reconciliação por referência externa. O ledger financeiro é a fonte contábil interna.

## Fases
1. Escolher provedor e fluxo permitido: pagamento in-app, carteira móvel, transferência ou apenas cash inicial; confirmar moedas e requisitos comerciais.
2. Definir máquina de estados e contratos API/UI; testar idempotência, expiração, callback duplicado, timeout e valor/moeda divergentes.
3. Integrar sandbox com criação/consulta de pagamento, webhooks assinados e rotina de reconciliação; não confiar no redirect do cliente como prova.
4. Ligar lançamentos ao ledger e oferecer lista de pendências, diferença, idade e referência do PSP no painel.
5. Implementar reembolso total/parcial e disputa como eventos compensatórios com permissão financeira, motivo e prova.
6. Ativar o método por feature flag depois de reconciliação sandbox e piloto controlado; preservar cash como fallback quando aplicável.

## Critérios de aceitação
- Só webhook/API servidor confirma pagamento.
- Callback repetido e eventos fora de ordem não duplicam nem reabrem pagamento.
- Valor, moeda, corrida e referência externa são conciliados.
- Reembolso tem autorização, motivo, ligação ao lançamento original e estado confirmado pelo provedor.
- O app informa pendência/erro sem marcar sucesso prematuro.

## Dependências, riscos e validação
Depende do ledger e da decisão de PSP. Não assumir que Stripe ou qualquer fornecedor aceita a entidade/país; validar condições comerciais antes de implementar. Credenciais ficam exclusivamente no servidor, e o modo sandbox precisa provar casos de falha antes da ativação.


