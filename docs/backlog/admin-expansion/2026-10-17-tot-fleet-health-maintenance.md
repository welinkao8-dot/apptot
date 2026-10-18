# Plano 14 — Saúde da frota e manutenção preventiva

## Planning header

- Goal: Saúde da frota e manutenção preventiva.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Ajudar operações a antecipar imobilizações e acompanhar custos de veículos. Hoje não há entidade/estado de manutenção ou histórico de inspeções associado a veículos; primeiro é preciso criar o cadastro da frota.

## Arquitetura proposta
Acrescentar odómetro/leituras com fonte e data, manutenção planeada, execução, custo, oficina e documentos. Alertas usam regras simples configuráveis por quilometragem/data e estado de segurança. Dados não são usados para penalizar motorista automaticamente.

## Fases
1. Decidir se quilometragem é recolhida manualmente, no início/fim da corrida ou por telemetria disponível; medir precisão antes de prometer prevenção.
2. Modelar manutenção, inspeção, incidentes mecânicos, custo e histórico de odómetro.
3. Painel com calendário, próximos vencimentos, custo por veículo, indisponibilidade e ação de retirar/repor em serviço.
4. Impedir atribuição a veículo marcado indisponível; permitir exceção somente com papel e motivo próprios.
5. Notificar gestor de frota sem rastrear condução fora da viagem.
6. Testar odómetro incoerente, manutenção atrasada, veículo em corrida, edição concorrente e custo sem comprovativo.

## Critérios de aceitação
- Histórico de manutenção é auditável e ligado a veículo/autor.
- Veículo inseguro/inativo não recebe viagem nova, sem interromper uma corrida em curso de forma abrupta.
- Indicador de custo deixa claro se dado foi declarado ou medido.
- Nenhum sistema afirma previsão se os dados estiverem incompletos.
- Manutenção concluída pode ser comprovada e encerrada por pessoa autorizada.

## Dependências, riscos e validação
Depende dos planos 02 e 03. Iniciar como agenda e registo com métricas simples. Previsão baseada em telemetria só entra depois de qualidade de dados comprovada.


