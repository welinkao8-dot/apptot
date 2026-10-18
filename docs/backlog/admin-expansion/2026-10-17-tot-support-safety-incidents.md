# Plano 09 — Apoio ao cliente, incidentes e segurança

## Planning header

- Goal: Apoio ao cliente, incidentes e segurança.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Permitir que equipa e utilizadores resolvam incidentes ligados a uma viagem. Os modelos observados não incluem tickets, incidentes, categoria de reclamação, SLA, anexos seguros ou escalonamento. A auditoria administrativa não substitui um fluxo de suporte.

## Arquitetura proposta
Criar ticket ligado opcionalmente a cliente, motorista, viagem, veículo, pagamento ou entrega. Categorias iniciais: problema de viagem, cobrança, objeto perdido, segurança, comportamento e entrega. Guardar prioridade, responsável, estado, mensagens internas separadas das mensagens ao utilizador, prazos e resolução. Um botão SOS deve gerar evento com contexto mínimo, sem assumir que a central consegue contactar emergência automaticamente.

## Fases
1. Desenhar política de emergência, escopo de suporte, cobertura horária, papéis e dados que podem ser vistos.
2. Criar API/tabelas para ticket, evento, atribuição, SLA e anexo privado; trilha auditável e política de retenção.
3. Criar inbox de suporte com filtros, estados, responsável, notas internas, resposta e relação com corrida/pagamento.
4. Acrescentar reportar problema nos apps e fluxo de emergência com confirmação clara; preservar telefone/canais reais disponíveis na região.
5. Permitir resolução/refund request sem executar reembolso sem autorização financeira.
6. Ensaiar perda de ligação, ameaça imediata, falsa denúncia, dados duplicados, anexo abusivo e escalonamento fora de horário.

## Critérios de aceitação
- Ticket tem proprietário, SLA, histórico e estado; nenhuma resolução apaga mensagens.
- Incidente crítico notifica responsáveis definidos e mostra se foi reconhecido.
- Dados sensíveis só são acessíveis aos papéis necessários e ficam auditados.
- O app não promete serviço de emergência/monitorização inexistente.
- Uma denúncia não suspende automaticamente alguém sem política de revisão e defesa definida.

## Dependências, riscos e validação
Depende de RBAC, notificações e identidade de viagem. Não lançar SOS como botão cosmético: requer responsável operacional, canal testado e procedimento humano publicado. Definir retenção e escalonamento com a operação.


