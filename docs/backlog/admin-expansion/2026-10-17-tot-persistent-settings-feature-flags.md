# Plano 13 — Configurações persistidas e feature flags

## Planning header

- Goal: Configurações persistidas e feature flags.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Eliminar controles que parecem guardar uma alteração mas não persistem. A auditoria atual registou que /admin/settings é informativo/read-only e que a persistência verdadeira está essencialmente nos serviços/tarifas. Mudanças globais não devem depender de editar constantes ou ambiente e reiniciar o servidor sem fluxo controlado.

## Arquitetura proposta
Criar parâmetros versionados com escopo, tipo, valor validado, vigência e autor. Separar configuração comercial, técnica e feature flags. Flags podem habilitar um recurso por ambiente/coorte, com padrão seguro e rollback; segredos nunca são guardados nesta tela.

## Fases
1. Inventariar cada valor exibido e decidir se é configuração real, derivada, segredo ou futura feature.
2. Criar API estrita, tabela versionada, cache invalidado e trilha auditável; validar tipo/intervalo.
3. Substituir controles falsamente editáveis por campos realmente persistentes e mostrar vigência/última alteração.
4. Implementar feature flags para ativação gradual de pagamentos, entrega com PIN e novas telas; sem permitir código arbitrário.
5. Criar comparação de versão e rollback para operadores autorizados.
6. Testar concorrência, valor inválido, cache desatualizado, falha de deploy e rollback.

## Critérios de aceitação
- Todo campo editável mostra sucesso só depois de confirmação do servidor.
- Configuração crítica tem valor anterior/novo, autor, motivo e vigência.
- Segredos não são devolvidos nem editáveis no admin.
- Flag pode ser desligada sem migration reversa nem estado órfão.
- Se a configuração falha, o sistema usa um padrão seguro documentado.

## Dependências, riscos e validação
Depende de RBAC. Não armazenar URL/token de provedor como configuração visível. Mudanças de tarifa precisam permanecer no domínio versionado de cotação, não virar flag genérica.


