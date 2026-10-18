# Plano 06 — Recibos, faturas e conformidade fiscal

## Planning header

- Goal: Recibos, faturas e conformidade fiscal.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Separar comprovativo operacional de documento fiscal. Há registos chamados invoices/recibos associados à viagem, mas a existência do registo/PDF não demonstra pagamento nem prova conformidade fiscal. Não há base para afirmar que o sistema já emite fatura fiscal válida em Angola.

## Arquitetura proposta
Manter documento imutável com número único, emissor, cliente, linhas, impostos, moeda, totais, estado, data e referência de pagamento. Gerar PDF a partir do documento persistido e guardar cópia/identificador de validação. Distinguir recibo de pagamento, fatura, nota de crédito e documento ainda por pagar.

## Fases
1. Confirmar com contabilista/autoridade fiscal angolana quais documentos, sequências, campos, retenção e integração certificada se aplicam ao TOT; registar a decisão antes de desenvolver regra fiscal.
2. Mapear o invoice atual, definir campos e estados sem reinterpretar históricos.
3. Criar serviço de emissão idempotente que só emite o tipo correto no evento correto; separar finalizar viagem de confirmar cash.
4. Implementar numeração segura concorrente, geração determinística do PDF e armazenamento não público; corrigir/reemitir por documento compensatório, nunca apagar.
5. Painel para consulta, download autorizado, envio ao cliente e exportação de período.
6. Validar cancelamento, reembolso, pagamento parcial, falha de PDF, duplicados e auditoria com orientação contabilística.

## Critérios de aceitação
- Documento identifica se é fiscal, comprovativo ou apenas resumo; nunca confunde emissão com pagamento.
- Nenhum PDF é mostrado como disponível sem ficheiro válido.
- Numeração não duplica com concorrência/retry.
- A emissão e correção preservam história e têm ator/motivo.
- Regras só são ativadas depois da validação fiscal local.

## Dependências, riscos e validação
Depende do ledger e dos fluxos de pagamento. A análise de código não substitui parecer contabilístico/fiscal. Não aplicar regras fiscais de outro país nem fazer backfill com pressupostos sobre documentos antigos.



## Clarificação de escopo e execução — 18/10/2026

O proprietário confirmou que o app cliente deve produzir **um recibo operacional não fiscal**, que o cliente pode guardar, partilhar ou imprimir como registo. Não emitir factura fiscal pelo app. O escopo fiscal originalmente descrito neste backlog (regras tributárias, série AGT, certificação e integração fiscal) não faz parte desta entrega e exige um plano separado se for pedido no futuro.

- [x] Histórico do app cliente identifica o documento como não fiscal.
- [x] PDF operacional gerado localmente apenas a pedido, com origem/destino, referência, data, valor e estado do pagamento persistido.
- [x] Folha nativa permite guardar/partilhar/imprimir; erro de geração é tratado sem mostrar ficheiro inexistente.
- [x] Recibo confirmado usa o montante do pagamento persistido; pendente não afirma que foi pago.
- [x] Testes e autolinking verificados; relatório: `docs/plan-06-operational-receipt-2026-10-18.md`.
- [ ] Verificação da geração/partilha/impressão em aparelho permanece no gate final do Plano 05. Não gerar APK nem declarar teste em telefone nesta fase.

**Estado:** implementação do Plano 06 concluída no escopo operacional não fiscal; validação física será feita no gate final. Sem alterações ao painel admin, dados históricos, API, banco ou migrations.
