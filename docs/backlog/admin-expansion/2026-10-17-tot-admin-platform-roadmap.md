# Plano mestre — Evolução do painel e capacidades administrativas TOT

## Goal
Transformar o painel atual num centro seguro de gestão da operação TOT, incluindo frota, controlo de acesso, finanças, despacho, entregas, suporte e ferramentas de decisão. Manter as aplicações mobile cliente/motorista como parte dos fluxos quando necessário. Não incluir portais web públicos de cliente/motorista.

## Architecture
Expandir o monólito NestJS/Prisma por módulos de domínio; interfaces administrativas consomem contratos tipados e a API aplica autorização. Alterações financeiras são lançamentos imutáveis; mudanças operacionais são auditáveis; notificações usam outbox; dados de veículo/documento/entrega têm ciclo de vida próprio. Métricas derivam de eventos confirmados e do ledger, não de estimativas de UI.

## Tech Stack
React/Vite no painel administrativo; NestJS no backend; PostgreSQL/Prisma; Socket.IO/push já usados em partes do sistema; HERE permanece o fornecedor de mapas/rotas existente até revisão explícita de cobertura e custo.

## Spec path
docs/backlog/admin-expansion/admin-platform-capability-audit-2026-10-17.md

## Global Constraints
- Trabalhar diretamente no checkout existente; não criar worktree.
- Não fazer deploy nem build de APK local. APK de teste é produzido pelo GitHub quando chegar o gate de validação.
- Manter identidade visual e padrões existentes do painel; planos de capacidade não autorizam redesign genérico.
- Migrations aditivas, backfill revisto e rollback/runbook por domínio; não apagar histórico financeiro/documental.
- Segredos nunca entram no frontend, notas Obsidian ou outputs.
- Operações críticas exigem papel, motivo, auditoria e idempotência.
- Localização é recolhida/mostrada apenas segundo finalidade e estado operacional; nunca assumir tracking fora de turno.
- Validar requisitos fiscais/documentais em Angola antes de implementar regras fiscais.
- Atualizar o Obsidian ao fechar cada fase de uma implementação futura.

## Baseline
O painel já contém Visão Geral, Operação Live, Motoristas, Clientes, Tarifas/Serviços, Corridas, Faturas, Pagamentos, Auditoria e Configurações. Há API admin, pagamentos cash pendentes/confirmados, ofertas de corrida, autenticação e analytics básicos. As lacunas e limitações comprovadas estão no relatório de auditoria. Nenhum plano abaixo está implementado por este documento.

## Iniciativas e ordem

| Ordem | Plano | Prioridade | Motivo/dependência |
|---|---|---|---|
| 01 | [Acessos, cargos e permissões](2026-10-17-tot-admin-rbac-access.md) | P0 | Controlo de quem pode executar ações financeiras/operacionais |
| 02 | [Cadastro de frota e atribuição de veículos](2026-10-17-tot-fleet-vehicles.md) | P0 | Identificar veículo real e suportar app, despacho e compliance |
| 03 | [Onboarding e conformidade do motorista](2026-10-17-tot-driver-onboarding-compliance.md) | P0 | Definir elegibilidade e validade documental |
| 04 | [Livro financeiro e ganhos líquidos](2026-10-17-tot-financial-ledger-earnings.md) | P0 | Fonte de verdade para saldos, comissão e relatórios |
| 05 | [Pagamentos, reconciliação e reembolsos](2026-10-17-tot-payment-rails-reconciliation-refunds.md) | P0 | Cobrar/confirmar corretamente sem afirmar método não integrado |
| 06 | [Recibos, faturas e conformidade fiscal](2026-10-17-tot-fiscal-receipts-invoices.md) | P1 com gate fiscal | Separar documento operacional de documento fiscal válido |
| 07 | [Centro de despacho ao vivo](2026-10-17-tot-live-dispatch-control-tower.md) | P0/P1 | Fila SLA e intervenção controlada em viagens |
| 08 | [Entregas e prova de entrega](2026-10-17-tot-delivery-proof-chain.md) | P1 | Cadeia de custódia, tentativas e devolução |
| 09 | [Apoio, incidentes e segurança](2026-10-17-tot-support-safety-incidents.md) | P1 | Resolver problemas e gerir riscos com responsáveis |
| 10 | [Zonas, horários, turnos e tarifas](2026-10-17-tot-service-zones-hours-shifts.md) | P1 | Controlar onde/quando a oferta é possível |
| 11 | [Centro de notificações confiável](2026-10-17-tot-notification-reliability-center.md) | P1 | Outbox, retries e visibilidade de push |
| 12 | [Métricas, relatórios e alertas](2026-10-17-tot-operational-analytics-alerts.md) | P1 | Indicadores verificáveis e alertas com dono |
| 13 | [Configurações persistentes e flags](2026-10-17-tot-persistent-settings-feature-flags.md) | P1 | Tirar controles simulados/read-only sem persistência |
| 14 | [Saúde e manutenção de frota](2026-10-17-tot-fleet-health-maintenance.md) | P2 | Prevenir indisponibilidade e medir custo real |
| 15 | [Mapa inteligente de procura/oferta](2026-10-17-tot-demand-supply-intelligence.md) | P2 inovador | Prever pressão por zona e sugerir ações explicáveis |
| 16 | [Anomalias e revisão de risco](2026-10-17-tot-risk-anomaly-review.md) | P2 inovador | Detetar padrões sem punição automática opaca |
| 17 | [Agendamento e contas empresariais](2026-10-17-tot-scheduled-and-business-accounts.md) | P2 crescimento | Abrir canal B2B depois de SLA/financeiro |
| 18 | [Avaliações e qualidade de serviço](2026-10-17-tot-service-quality-feedback.md) | P2 | Feedback verificável com proteção antiabuso |
| 19 | [Saúde do sistema e integrações](2026-10-17-tot-system-integration-health.md) | P1 | Mostrar falhas de API, push, mapas, filas e anexos |
| 20 | [Assistente de operações com IA](2026-10-17-tot-operations-copilot.md) | P2 inovador | Acelerar investigação com respostas ligadas a dados, sem automação de ações |

## Sequência de execução futura

1. Fechar definição funcional, propriedade do processo e permissões antes das migrations.
2. Implementar base fundacional: RBAC, frota, elegibilidade, ledger, pagamentos e despacho.
3. Fechar o ciclo operacional: documento fiscal após validação local, entrega, suporte, zonas, notificações.
4. Criar métricas confiáveis, configuração persistida e painel de saúde.
5. Pilotar ideias P2 uma a uma, começando por manutenção e procura agregada.
6. Medir operação, recolher resultados e só depois avançar para score de risco, B2B/agendamento e novas automações.

A ordem pode ser ajustada por dependências encontradas ao implementar, mantendo cada iniciativa com o seu plano próprio.

## Gates comuns de aceitação
Cada plano define critérios próprios. Além deles, toda a entrega deverá cobrir sucesso, falha, retry/duplicação, concorrência, permissões, auditoria, migration/rollback e compatibilidade dos apps quando tocados. Os testes são executados durante implementação; este pacote documental não adicionou nem executou testes.

## Fontes de inspiração técnica
- Uber Fleet Hub apresenta gestão de veículos e motoristas, acompanhamento por veículo/motorista, mapa ao vivo e relatórios: https://www.uber.com/us/en/earn/fleet-management/
- Uber Fleet Hub descreve detalhe de pagamentos e liquidação de motoristas, com processos que variam conforme região: https://help.uber.com/fleet/article/managing-payments-and-earnings-in-the-fleet-hub-portal?nodeId=d88a3e39-be7a-4c2b-b2c1-a9fd91d50bb8
- Google Route Optimization documenta capacidades, janelas de tempo, capacidade, horas de trabalho e balanceamento de frota: https://developers.google.com/maps/documentation/route-optimization/overview

Esses exemplos não são uma instrução para copiar o produto nem garantem disponibilidade/custo na região do TOT.


