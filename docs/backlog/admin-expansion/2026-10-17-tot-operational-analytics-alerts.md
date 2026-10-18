# Plano 12 — Métricas operacionais, relatórios e alertas

## Planning header

- Goal: Métricas operacionais, relatórios e alertas.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Dar decisões com números definidos e rastreáveis. Hoje existem stats e analytics básicos (corridas, operadores online e receita confirmada) e listas paginadas em evolução. Não existe catálogo completo de métricas, exportações financeiras robustas, metas, alertas por SLA ou trilha do cálculo dos indicadores.

## Arquitetura proposta
Definir um catálogo com fórmula, fonte, fuso Africa/Luanda, granularidade e proprietário. Separar receita confirmada, valor bruto, comissão, saldo de motorista, volume solicitado, aceitação, cancelamento, tempo de atribuição e entrega no prazo. Iniciar consultas agregadas do banco; usar warehouse só quando volume/custo justificar.

## Fases
1. Aprovar definições e regras contra dados duplicados/incompletos.
2. Criar endpoints agregados por período/serviço/zona/veículo/motorista, respeitando autorização e paginação.
3. Criar dashboards e relatórios CSV com filtros, intervalo, timezone e data de geração; explicitar dados incompletos.
4. Construir alertas acionáveis para fila de ofertas, pagamento divergente, documentação expirada e push falhado.
5. Definir limiares e responsáveis; deduplicar alertas e permitir reconhecer/encerrar.
6. Verificar métricas contra amostras das tabelas e relatório financeiro fechado.

## Critérios de aceitação
- Cada indicador apresenta definição e período; totais coincidem com consulta de referência.
- Exportação aplica permissões, filtros e limites; grandes relatórios são assíncronos.
- Fuso e período são determinísticos e exibidos.
- Alertas têm responsável, idade, severidade e estado.
- Nenhum gráfico inventa zeros ou tendências quando faltam dados.

## Dependências, riscos e validação
Depende de ledger, eventos de despacho e configurações persistidas. Evitar copiar dados pessoais para um warehouse sem necessidade. A evolução para previsão é plano independente e não deve contaminar os KPIs factuais.


