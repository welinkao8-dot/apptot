# Plano 18 — Avaliações e qualidade de serviço

## Planning header

- Goal: Avaliações e qualidade de serviço.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Criar feedback bilateral e indicadores que ajudem a corrigir problemas. Há campo rating no registo do motorista, mas não foi identificado um ciclo completo de avaliação de viagem, categorias de motivo, resposta ou política contra retaliação.

## Arquitetura proposta
Avaliações vinculadas à viagem e submetidas uma vez por ator autorizado, com janela e moderação. Separar nota privada operacional de comentário público. Métricas agregadas, limiar mínimo de amostras e direito de contestar decisão administrativa.

## Fases
1. Definir escalas, perguntas curtas, categorias de problema, anonimização e critérios de moderação.
2. Criar armazenamento ligado à viagem com unicidade por autor/viagem, estado e motivo opcional.
3. Adicionar UX leve nos apps sem impedir fechar a viagem; evitar pedir nota antes de confirmar pagamento indevidamente.
4. Painel mostra tendências agregadas com denominador, janela e número mínimo de avaliações.
5. Ligar somente alertas graduais a suporte/compliance; não suspender com uma avaliação isolada.
6. Validar abuso, comentário ofensivo, pequena amostra, corrida cancelada e recurso do motorista/cliente.

## Critérios de aceitação
- Uma avaliação não pode ser duplicada nem alterada silenciosamente após período definido.
- Resultados publicados são agregados e suprimem amostras pequenas.
- Reclamação de segurança vai para o fluxo de incidente, não é resolvida por estrelas.
- Decisões adversas exigem evidência e revisão humana.
- Nota exibida declara quantidade e período da amostra.

## Dependências, riscos e validação
Depende de suporte e RBAC. Não tratar rating como prova de má conduta e não criar rankings públicos sem política de proteção contra manipulação.


