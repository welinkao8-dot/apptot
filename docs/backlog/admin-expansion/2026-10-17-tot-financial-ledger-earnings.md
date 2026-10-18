# Plano 04 — Livro financeiro, tarifas e ganhos líquidos

## Planning header

- Goal: Livro financeiro, tarifas e ganhos líquidos.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Transformar os registos financeiros básicos em números reconciliáveis. O TOT não está sem qualquer controlo financeiro: há registos de pagamento em numerário pendente/confirmado, confirmação pelo motorista e relatórios baseados em pagamentos confirmados. Mas ainda não há livro imutável de lançamentos, liquidação a motoristas, despesas, reembolsos nem decomposição verificável de receita. Uma fatura criada não prova que o dinheiro foi recebido.

## Arquitetura proposta
Implementar ledger de partidas balanceadas, com montante, moeda, tipo, entidade origem, ator, data efetiva e chave de idempotência. Guardar snapshot de tarifa e comissão na cotação/viagem. Separar valor cobrado ao cliente, comissão TOT, parte do motorista, ajustes, pagamento e transferência. Não recalcular história quando a tarifa atual muda.

## Fases
1. Definir glossário/KPIs: receita bruta, receita confirmada, comissão ganha, valor devido ao motorista, caixa recebido e saldo por liquidar.
2. Mapear dados atuais de trips, trip_quotes, trip_payments e invoices; criar relatório de reconciliação de legado antes de qualquer backfill.
3. Criar ledger e migração aditiva; publicar lançamentos na mesma transação lógica dos eventos financeiros, com idempotência e referência original.
4. Capturar tarifa, taxa, método e arredondamento como snapshot; definir tratamento de cancelamento, ajuste e pagamento parcial.
5. Criar extrato por viagem, motorista, período e método; saldo pendente, divergências, exportação e fecho diário.
6. Só permitir fechar/editar com ajuste compensatório auditado; não apagar lançamentos.
7. Validar reconciliação automática contra pagamentos confirmados e amostras revisadas pela equipa financeira.

## Critérios de aceitação
- Soma dos lançamentos balanceia por moeda e cada linha aponta para evento origem.
- Ganhos líquidos são distintos de tarifa bruta e só mudam por lançamentos explicados.
- Repetir webhook/comando não duplica receita nem liquidação.
- Um fecho de período reproduz os mesmos totais depois de alterações futuras de tarifa.
- Interface deixa explícito o que é estimativa, devido e efetivamente recebido.

## Dependências, riscos e validação
É a base para pagamento digital, reembolsos e relatórios fiscais. Backfill só depois de reconciliar inconsistências; não converter fatura em recebimento. O plano não escolhe política de comissão nem calendário de repasse: isso precisa ser configurado pela operação.


