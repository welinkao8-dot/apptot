# Plano 10 — Zonas de serviço, horários, turnos e tarifas

## Planning header

- Goal: Zonas de serviço, horários, turnos e tarifas.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e situação atual
Evitar aceitar corridas em locais/horários onde a operação não consegue servir e gerir disponibilidade de equipa. Existem tarifas/configurações por serviço e uma tabela driver_shifts simples, mas não há módulo de zonas/áreas, gestão operacional dos turnos ou regras de serviço por cobertura evidenciadas.

## Arquitetura proposta
Modelar zonas com geometria/versionamento, serviços permitidos, horários, requisitos de frota e regras de tarifa; armazenar o identificador/versionamento de zona na cotação. Implementar turnos com reserva/confirmado/iniciado/terminado/ausente, sem confundir turno planeado com motorista online. Usar primeiro política de zonas explícita; incluir HERE apenas se validar suporte e cobertura na região.

## Fases
1. Mapear áreas de operação reais, horários, fronteiras de risco e exceções; validar política com despacho.
2. Criar modelos para zona e versão, horário, turnos e associação; desenhar comportamento de sobreposição e alteração futura.
3. Criar ferramentas administrativas de desenho/edição com preview de impacto, publicação agendada e rollback de versão.
4. Fazer cotação e despacho consultarem a mesma política versionada; explicar indisponibilidade ao cliente.
5. Implementar calendário/lista de turnos, check-in e alertas de falta; não forçar tracking de localização fora do turno.
6. Testar fronteiras, polígonos inválidos, troca de fuso/data, motorista em área limítrofe e cotação ainda válida após mudança.

## Critérios de aceitação
- Cotações e despacho usam a mesma versão de regra.
- Mudanças não alteram o preço de cotação já emitida.
- Zonas e turnos têm histórico, autor, vigência e rollback.
- Cliente recebe razão operacional para indisponibilidade, sem coordenadas internas.
- Turno não significa rastreio contínuo fora do horário autorizado.

## Dependências, riscos e validação
Depende de modelo de frota, cotação/roteamento e decisão operacional. Geometrias, cobertura HERE e direitos de uso devem ser testados em Luanda antes de automatizar bloqueios.


