# Plano 11 — Centro de notificações e entrega confiável

## Planning header

- Goal: Centro de notificações e entrega confiável.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Garantir que notificações importantes são entregues, repetíveis e observáveis. Existe registo de tokens FCM para motoristas e envio de push de ofertas; não há modelo equivalente observado para clientes, nem outbox/estado de entrega, preferências, deduplicação ou gestão de falha no painel.

## Arquitetura proposta
Adotar notification outbox: evento de domínio cria mensagem pendente transacionalmente; worker tenta enviar, guarda tentativas, resposta sanitizada, estado e chave de deduplicação. Push é canal de melhor esforço; apps devem sempre restaurar o estado pela API/socket. Guardar tokens por conta/dispositivo e invalidar token rejeitado.

## Fases
1. Listar eventos e prioridade (oferta, alteração de corrida, pagamento, entrega, segurança, marketing) e política de consentimento/canal.
2. Unificar registo/revogação de token por role, conta, dispositivo e plataforma; introduzir outbox e retentativas com backoff.
3. Ligar eventos de domínio à outbox sem depender do push para transição de estado.
4. Criar painel de falhas e reenviar somente notificações elegíveis com idempotência; nunca expor conteúdo privado além do permitido.
5. Apps apresentam preferência, estado lido quando suportado e recuperação ao abrir; manter fallback in-app/SMS apenas se o canal existir.
6. Testar token expirado, duplicado, sem rede, fila parada, atraso, logout e mudança de utilizador no mesmo aparelho.

## Critérios de aceitação
- Falha de push não perde nem duplica corrida/pagamento.
- Cada notificação crítica tem estado/tentativas e chave de deduplicação.
- Token inválido é revogado e não fica em loop.
- Reabrir app reconcilia estado com o servidor.
- Push de oferta não concede corrida; aceite sempre valida no servidor.

## Dependências, riscos e validação
Depende de RBAC e eventos de domínio. Push não é garantia de entrega e não pode ser única forma de comunicar mudança crítica. Preferências e base legal devem ser definidas antes de notificações comerciais.


