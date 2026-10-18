# Plano 01 — Acessos, cargos e permissões administrativas

## Planning header

- Goal: Acessos, cargos e permissões administrativas.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Permitir que cada pessoa da equipa veja e execute apenas o que precisa. Hoje os endpoints do Admin API estão protegidos por autenticação e por um único papel amplo, admin; não existe catálogo de cargos/permissões nem gestão de contas administrativas identificada. A auditoria já grava ações em alguns fluxos, mas não substitui autorização por função.

## Arquitetura proposta
Introduzir utilizadores administrativos e atribuições de papéis com permissões explícitas e verificadas na API. A interface esconde ações sem permissão para orientar o operador, enquanto a API continua a ser a autoridade. Registar alterações de cargos, tentativas negadas e operações sensíveis sem guardar segredos.

## Fases
1. **Modelo e política:** inventariar ações, classificar risco, definir papéis iniciais (superadministrador, operações, frota, financeiro, suporte, auditoria) e separar utilizador cliente/motorista de utilizador interno.
2. **API e dados:** criar tabelas de admin users, roles, permissions e assignments; migration aditiva; converter administradores existentes para o papel equivalente; manter um superadministrador de recuperação; exigir autorização em cada rota sensível.
3. **Painel:** criar gestão de equipa, papéis, permissões, convites, ativação/desativação e histórico; mostrar ações permitidas e negar controles no servidor quando não autorizados.
4. **Sessões seguras:** política de senha, rotação/revogação de sessão e MFA para financeiro/superadministrador como etapa separada de compatibilidade; sem bloquear recuperação de conta.
5. **Auditoria e validação:** cobrir acesso permitido/negado, remoção do último superadministrador, escalada de privilégios e migração de contas.

## Critérios de aceitação
- Uma conta sem permissão não consegue executar a ação chamando diretamente a API.
- Papéis e permissões são administráveis e cada alteração sensível fica auditada com ator, alvo e motivo.
- A migração conserva o acesso aos administradores atuais e tem rollback documentado.
- Não é possível remover/desativar o último superadministrador.

## Dependências, riscos e validação
É pré-requisito para delegar operações e financeiro com segurança. A migration deve ser aditiva e compatível com as contas atuais. Validar testes de autorização por rota e revisão de segurança; acesso de emergência deve ser testado antes de qualquer remoção de conta.


