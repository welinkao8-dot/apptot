# Plano 05 — verificação local — 18/10/2026

## Resultado

Gate local automatizado aprovado. O Plano 05 continua PARCIAL: validação real de dispositivos/staging e release permanece adiada pelas regras do utilizador.

## Evidência executada

| Área | Resultado |
|---|---|
| Backend unitários | PASS — Jest, 44 suites / 421 testes |
| Admin API E2E | PASS — 26/26 |
| Client API E2E | PASS — 35/35 |
| Driver API E2E | PASS — 24/24 |
| App cliente | PASS — 15 suites / 122 testes |
| App motorista | PASS — 23 suites / 129 testes |
| Frontend admin | PASS — 79/79 |
| Configuração de deployment | PASS — 3/3 |
| Builds Nest | PASS — admin-api, client-api e driver-api |
| PostgreSQL descartável | PASS — `npm run test:plan01:postgres`; migrations/schema, backfill/rollback, concorrência e quote após atualização de tarifa. Harness remove os próprios dados/container. |
| APIs locais | PASS — foram iniciadas separadamente; healthchecks das três APIs responderam HTTP 200. Apenas Admin API e frontend foram deixados activos para o teste do utilizador. |

## Estado por tarefa do Plano 05

- **Tarefa 1 — ambiente e compatibilidade de schema: PASS local.** PostgreSQL descartável, configurações de deployment, stack Nest, fixtures fictícias e limpeza foram verificados. Não houve reinício/reconfiguração de containers pessoais.
- **Tarefa 2 — cliente: PARCIAL.** Fluxos automatizados de mapa/quote/ride/delivery e reconciliação têm cobertura; GPS real, permissões nativas, HERE/mapa em aparelho, rede e jornada completa continuam por validar em dispositivo/staging.
- **Tarefa 3 — motorista: PARCIAL.** E2E, mobile e concorrência real de aceitação passaram. FCM, estados de background/force-stop, permissões nativas e navegação externa real requerem credenciais/dispositivo.
- **Tarefa 4 — painel: PARCIAL.** API, sessão, pricing, auditoria e frontend têm testes; o utilizador aceitou manualmente o painel no Plano 04. A jornada completa painel/API/cliente/motorista em ambiente integrado continua pendente.
- **Tarefa 5 — caos/carga: PARCIAL.** Concorrência/idempotência em PostgreSQL passou; injeção real de latência/DNS, carga e observação de recursos ainda não foi executada.
- **Tarefa 6 — release readiness: PARCIAL.** Builds Docker locais e runtime healthcheck das três APIs aprovados; APK no GitHub, Coolify, deploy, staging remoto e telefone adiados.

## Pendência da base local

A migration `20261017130000_private_driver_documents` foi parada pela validação ao encontrar dois documentos legados inválidos. A tentativa não apagou nem alterou os documentos e o estado da migration foi registado como rollback. A migration `20261018100000_admin_auth_sessions` foi aplicada apenas na base local para viabilizar o login admin. A migration de documentos privados não está aplicada nessa base; isso não invalida o PASS do harness descartável, que usa fixtures válidas.

## Restrições respeitadas

Sem APK/AAB, deploy, push, Coolify, staging remoto ou telefone. As alterações locais preexistentes foram preservadas.

## Adenda — gates locais sem dispositivo (18/10/2026)

### Imagens Docker de produção

- PASS — `docker build -f backend.Dockerfile -t tot-plan05-backend-local:20261018 .`: o Dockerfile compilou Prisma e os quatro alvos Nest, e empacotou a imagem runtime.
- PASS — `docker build -f frontend.Dockerfile --build-arg PORTAL_PATH=admin-portal/frontend --build-arg VITE_API_URL=https://admin-api.invalid -t tot-plan05-admin-frontend-local:20261018 .`: Vite compilou e a imagem Nginx foi criada. O domínio `.invalid` foi apenas um valor-sentinela para build; não é URL para deploy.
- Na primeira etapa, nenhum container foi iniciado/parado. Na validação seguinte foi usado um container admin temporário, depois removido. As imagens não foram publicadas nem usadas para deploy.

### Gaps identificados no próprio gate local

- Resolvido localmente — as três APIs Nest agora têm rate limit HTTP global; E2E demonstram HTTP 429 ao exceder limite. O limite padrão é 120 pedidos por IP e rota em 60 segundos; ambos os valores são configuráveis e Compose define-os explicitamente.
- Os testes existentes cobrem falhas simuladas de timeout/DNS/retry, 429 no cliente HERE, ACK, reconexão, idempotência e concorrência. Isto prova os comportamentos cobertos pelos testes; não substitui ensaio de rede real nem medição de memória/pool/timers.
- Node corrigido — os quatro Dockerfiles backend usam Node 22 (LTS), requerido por `firebase-admin@14.5.0`; rebuild da imagem passou, sem avisos EBADENGINE. Runtime das três APIs na imagem Node 22 confirmado em containers temporários: healthchecks 200. Admin também respondeu HTTP 429 após exceder 5 pedidos configurados. Todos os containers temporários foram removidos.
- `npm ci` reportou 69 vulnerabilidades no conjunto auditado do backend (inclui dev dependencies); `npm install` do admin reportou 22. São avisos do audit durante o build, não houve `npm audit fix`.
- Build do admin manteve o bundle JS principal em 1.210,53 kB minificado. O Dockerfile também declara `VITE_HERE_API_KEY` via ARG/ENV; foi passado vazio neste build. Não colocar chave real nesses argumentos sem resolver a exposição em metadados/camadas.

### Estado final sem dispositivo

- Tarefas 1–4: automações locais listadas anteriormente PASS; cada tarefa permanece PARCIAL porque contém passos manuais ou integrações que exigem aparelho/staging.
- Tarefa 5: PARCIAL; rate limit e respostas 429 passaram E2E nas três APIs. Ficam medições reais de latência/DNS, carga, recursos e armazenamento partilhado para múltiplas réplicas.
- Tarefa 6: PASS local para builds de imagens backend/admin e healthcheck runtime das três APIs; GitHub APK, release e staging continuam adiados conforme a instrução do proprietário.
- Dependência `@nestjs/throttler` foi adicionada; documentação e teste de configuração foram actualizados. Nenhuma alteração de dependências além desta foi feita.

### Implementação do rate limit e actualização de Node — 18/10/2026

- TDD confirmou primeiro o gap: teste E2E recebeu 401 (endpoint protegido sem auth) em vez de 429; configurado endpoint público por API e observado que o comportamento faltava.
- Implementado `@nestjs/throttler` como guard global HTTP nas três APIs, default 120 pedidos por IP e rota/60 segundos; variáveis `API_RATE_LIMIT_LIMIT` e `API_RATE_LIMIT_TTL_MS`; headers de rate limit; configuração inválida aborta o arranque.
- `TRUST_PROXY_HOPS` controla exactamente quantos proxies Express confia; default 0. Documentado risco de armazenamento em memória: cada réplica tem budget independente, requer store partilhado para escalar horizontalmente.
- E2E: admin 27/27, client 36/36, driver 25/25; cada uma provou HTTP 429; unitários backend 45 suites/426; configuração deployment 5/5; builds dos três Nest passaram. Imagem Node 22 iniciou Admin, Client e Driver contra DB local: health 200 nas três APIs; rate limit 429 verificado no Admin e E2E em cada API. Containers temporários foram removidos. Scheduler de documentos registou erro porque tabela/migration privada continua ausente nesta DB; nenhuma migration nem documento foi alterado.
- `docker compose -f docker-compose.prod.yml config --quiet` passou com sentinelas locais (sem mostrar valores). `docker build -f backend.Dockerfile -t tot-plan05-backend-node22-local:20261018 .` passou em Node 22 sem avisos EBADENGINE. Imagem é local, executada somente num container temporário e removido; não publicada.
- Node 20 foi End-of-Life em 24/03/2026 e `firebase-admin@14.5.0` declara Node >=22; imagens de produção foram actualizadas para Node 22 LTS.
- Limitações: sem alteração/deploy no Coolify; a Admin API local activa já devolve headers `X-RateLimit-Limit: 120` e `X-RateLimit-Remaining: 119`; nenhuma reinicialização manual foi necessária. Sem rate limiting de eventos Socket.IO; a regra aplica-se a HTTP. Para produção atrás de proxy, definir `TRUST_PROXY_HOPS` com a topologia real; não presumir o número.
