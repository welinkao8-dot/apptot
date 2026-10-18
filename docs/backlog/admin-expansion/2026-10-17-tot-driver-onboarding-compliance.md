# Plano 03 — Onboarding e conformidade do motorista

## Planning header

- Goal: Onboarding e conformidade do motorista.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Tornar aprovação e elegibilidade auditáveis. Hoje há estado do motorista e documentos de identidade/carta, mas o fluxo não representa de forma completa revisão, validade/expiração, pendências por documento ou revalidação periódica. A aprovação não deve ser confundida com possuir um ficheiro local.

## Arquitetura proposta
Modelar cada documento como registo versionado: tipo, referência segura ao ficheiro, estado, datas de validade, decisão, revisor e motivo. Regras de elegibilidade calculam se o motorista pode ficar online e receber ofertas, usando também estado do veículo e associação. Guardar apenas o necessário e controlar acesso a imagens.

## Fases
1. Mapear requisitos reais da operação e documentos exigidos; configurar política por categoria e consultar fonte local competente quando houver obrigação regulatória.
2. Criar estados submitted, under_review, approved, rejected, expired e superseded, com histórico imutável de decisões e alertas próximos da expiração.
3. Rever API de submissão e revisão para validação de MIME/tamanho, acesso privado, URLs temporárias e eliminação segura segundo retenção definida.
4. Painel com fila por prioridade, checklist, visualizador protegido, recusa com motivo e reenvio; impedir aprovação enquanto requisitos obrigatórios faltarem.
5. Aplicar elegibilidade na API de disponibilidade/despacho; o app explica o que falta e a data limite.
6. Testar expiração, reenvio, documentos inválidos, conta suspensa e perda temporária do serviço de ficheiros.

## Critérios de aceitação
- Só motorista elegível fica online/recebe oferta; a decisão vem do servidor.
- Revisor, hora, motivo e versão do documento são consultáveis em auditoria.
- Alertas não revelam documento ou token e são deduplicados.
- Dados privados não ficam expostos por endpoints gerais de perfil.

## Dependências, riscos e validação
Depende do modelo de veículos e RBAC. Não inventar requisitos legais: validar a lista documental, retenção e fundamento de recolha antes de ativar regras em produção. A revisão manual deve continuar possível quando um documento legítimo não puder ser lido automaticamente.


