# Plano 02 — Cadastro de frota e atribuição de veículos

## Planning header

- Goal: Cadastro de frota e atribuição de veículos.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Registar veículos reais, associá-los aos motoristas e disponibilizar os dados corretos no painel e nos apps. O modelo atual guarda apenas a categoria de veículo no registo do motorista. O app do motorista procura modelo e matrícula, mas o servidor não tem entidade de veículo nem associação persistida; a tela cai em valores genéricos.

## Arquitetura proposta
Criar entidade Vehicle com matrícula normalizada e única, marca, modelo, ano, cor, categoria, capacidade, estado operacional e datas de registo. Manter atribuições históricas motorista-veículo com início/fim, ator e motivo; não guardar um único driver_id como substituto do histórico. Separar dados públicos que o cliente vê dos dados internos da frota.

## Fases
1. **Regras da frota:** decidir se o TOT administra veículos próprios, aceita veículos de parceiros, ou ambos; definir categorias e campos obrigatórios por categoria, país e tipo de serviço.
2. **Base e API:** criar vehicles, vehicle_assignments e documentos do veículo; índices para matrícula/status; migration aditiva e importação inicial apenas após validação dos dados.
3. **Painel:** lista pesquisável, detalhe, criar/editar, suspender, histórico de atribuições, documentos e motivo/auditoria para alterações.
4. **Atribuição segura:** impedir atribuir veículo inativo, incompatível, expirado ou já atribuído simultaneamente; suportar substituição com período de vigência.
5. **Apps:** mostrar modelo/cor/matrícula ao motorista; ao cliente, mostrar apenas informação confirmada do veículo ativo quando a corrida é aceite; atualizar o resumo da corrida sem expor dados internos.
6. **Operação e testes:** validar concorrência em atribuições, veículo removido durante corrida e preservação do snapshot histórico da viagem.

## Critérios de aceitação
- Cada motorista ativo tem zero ou uma atribuição válida conforme a política decidida; conflitos são recusados no servidor.
- A matrícula e os documentos têm validação e trilha de auditoria.
- Cliente e motorista veem o veículo usado naquela viagem mesmo depois de uma futura troca.
- Veículo suspenso/expirado não recebe ofertas incompatíveis.

## Dependências, riscos e validação
Depende de RBAC e do plano de compliance documental. Não corrigir veículos de corridas passadas com a atribuição atual: guardar snapshot da relação usada em cada viagem. A operação deve confirmar formato de matrícula, categorias, campos legais e quem é proprietário antes de importar registos.


