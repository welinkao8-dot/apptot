# Plano 08 — Operação completa de entregas e prova de entrega

## Planning header

- Goal: Operação completa de entregas e prova de entrega.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Dar às entregas um ciclo próprio, verificável, sem tratar o campo delivery_info JSON como processo operacional. O schema mantém tipo/descrição/recipiente em JSON e usa grande parte do ciclo genérico de corridas; não há evidência de prova estruturada de recolha/entrega, tentativas, devolução ou cadeia de custódia.

## Arquitetura proposta
Criar eventos de entrega por etapa: recolhida, em trânsito, tentativa, entregue, falhada, devolução solicitada e devolvida. Guardar destinatário/telefone de forma protegida, instruções, tipo/tamanho/capacidade, identificador, prova associada e ator. A prova pode ser PIN de uso único, foto ou assinatura conforme risco e consentimento, nunca obrigando foto sensível por padrão.

## Fases
1. Definir tipos de pacote, categorias de veículo, limites e protocolo de prova para cada classe de risco.
2. Normalizar campos críticos do JSON e adicionar milestones/attempts e referências privadas a anexos; manter compatibilidade de viagens antigas.
3. Atualizar app do cliente para acompanhar marcos e receber confirmação; app motorista para recolha, tentativa, PIN/prova e falha/devolução.
4. Painel mostra cronologia, prova com acesso controlado, incidência e reatribuição; transições protegidas por estado/ator.
5. Implementar aviso ao destinatário e PIN com expiração, limite de tentativas e mascaramento de contacto.
6. Testar pacote não recolhido, cliente ausente, morada errada, destinatário diferente, fraude de prova, timeout e devolução.

## Critérios de aceitação
- Não é possível marcar como entregue sem cumprir a prova exigida para o tipo de entrega.
- Cada tentativa gera evento e motivo; a reexecução não duplica marcos.
- Cliente vê estados consistentes e o suporte consegue reconstruir a cadeia.
- Anexos não têm URL público permanente e seguem retenção definida.
- Modo de corrida não é afetado pelas regras de entrega.

## Dependências, riscos e validação
Depende de RBAC, notificações, veículo/capacidade e suporte. Definir consentimento, retenção de fotos, dados de destinatário e política para prova falhada antes de produção.


