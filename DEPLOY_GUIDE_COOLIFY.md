# Guia de Deploy TOT (Coolify)

Este guia explica como configurar o deploy automático para todos os serviços (APIs, Portais e Landing Page) a partir do seu repositório GitHub.

## 1. Preparação no Coolify
1. Aceda ao seu painel Coolify.
2. Vá a **Sources** e garanta que o seu GitHub está ligado.
3. Crie um novo **Project** (ex: "TOT MOTO TÁXI") e um **Environment** (ex: "Production").

## 2. Adicionar o Repositório
1. No seu Environment, clique em **+ Add New Resource**.
2. Selecione **Docker Compose**.
3. Escolha **GitHub Repository** como fonte.
4. Selecione o repositório `apptot` e a branch `main`.

## 3. Configurar o Stack
O Coolify lerá o ficheiro `docker-compose.prod.yml`. Precisas de configurar as variáveis de ambiente e domínios:

### Domínios (FQDN)
No separador **General**, configure os domínios para cada serviço. Exemplo:
- **landing-page**: `https://taxitot.com`
- **client-api**: `https://api.taxitot.com`
- **driver-api**: `https://driver-api.taxitot.com`
- **admin-api**: `https://admin-api.taxitot.com`
- **admin-portal**: `https://admin.taxitot.com`

> [!IMPORTANT]
> O serviço `landing-page` deve ser o domínio principal. No Coolify, configure o campo `Base Directory` como `./` e o `Docker Compose Location` como `./docker-compose.prod.yml`.

### Variáveis de Ambiente (.env)
No separador **Environment Variables**, adicione (ajuste conforme os seus domínios):
```env
DATABASE_USER=tot_user
DATABASE_PASSWORD=uma_password_segura
DATABASE_NAME=tot_database
JWT_SECRET=sua_chave_secreta_longa
ADMIN_API_URL=https://admin-api.taxitot.com
CLIENT_API_URL=https://api.taxitot.com
DRIVER_API_URL=https://driver-api.taxitot.com
DRIVER_API_SOCKET_URL=https://driver-api.taxitot.com
```

Adicione `HERE_MAP_API_KEY` e `HERE_ROUTING_API_KEY` como variáveis secretas do ambiente Coolify, sem copiar os valores para este guia ou para o repositório. `HERE_MAP_API_KEY` é a chave pública de browser usada nos builds dos portais e por `GET /locations/map-config`; restrinja-a às APIs necessárias, à aplicação e a quotas. `HERE_ROUTING_API_KEY` é privada e fica somente no `client-api` para chamadas HERE do servidor; nunca pode ser enviada ao browser nem usada como fallback de `GET /locations/map-config`.

## 4. Deploy Final
1. Clique em **Deploy**.
2. O Coolify vai construir todos os containers (Backend, Frontends e Landing Page).
3. Uma vez concluído, o site institucional estará ativo no seu domínio principal.

---
## Mobile (APK)
Para os aplicativos móveis, não usas o Coolify. 
1. Faz `git push` no teu PC.
2. Vai ao teu GitHub em **Actions**.
3. Seleciona o build concluído e faz download do APK no fundo da página.

## 5. Checklist operacional do próximo Deploy — estado em 18/10/2026

Esta secção substitui a sequência simplificada de “Deploy Final” acima. É um registo para executar quando o deploy for autorizado; **nada desta checklist foi executado no Coolify**. Os domínios `taxitot.com` são apenas exemplos antigos: confirmar os domínios reais antes de preencher o painel.

### A. Preparar o recurso no Coolify

- [ ] Confirmar o repositório, branch/revisão aprovada, `Base Directory` `./` e Compose `./docker-compose.prod.yml`.
- [ ] Confirmar que os serviços Compose são reconhecidos: `db`, `migrate`, `admin-api`, `client-api`, `driver-api`, `admin-portal`, `client-portal`, `driver-portal`, `landing-page` e `landing-frota`.
- [ ] Antes da release, guardar backup consistente da base PostgreSQL e dos ficheiros persistidos (`tot_data` e `admin_uploads`); confirmar como restaurar.
- [ ] Confirmar que `db` usa PostgreSQL 15 e que `DATABASE_URL` liga ao host Compose `db` (não `localhost`) com a base/utilizador correctos. Codificar caracteres especiais da password na URL.

### B. Configurar variáveis de ambiente no Coolify

Guardar os valores secretos directamente no gestor de variáveis do Coolify; nunca os copiar para Git, documentação ou conversa.

- [ ] `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_URL` — valores consistentes entre serviço `db`, APIs e job `migrate`.
- [ ] `JWT_SECRET` — segredo forte, igual nas três APIs.
- [ ] `INTERNAL_SERVICE_TOKEN` — segredo forte independente, igual em Admin API e Driver API para chamadas internas.
- [ ] `ALLOWED_ORIGINS` — origens exactas dos portais que chamam APIs, separadas por vírgula, com esquema e host, sem caminhos nem wildcard; usar os domínios finais HTTPS.
- [ ] `ADMIN_API_URL` — URL pública HTTPS da Admin API; também é usada para formar URLs públicas dos uploads e no build do portal admin.
- [ ] `CLIENT_API_URL`, `DRIVER_API_URL`, `DRIVER_API_SOCKET_URL` — URLs públicas HTTPS finais usadas pelos portais. Socket.IO deve funcionar por HTTPS/WSS.
- [ ] `HERE_MAP_API_KEY` — chave de mapa/autocomplete entregue aos browsers e usada pelo Client API; restringir por origens/aplicações, APIs e quotas. É pública no bundle; nunca usar aqui a chave privada de routing.
- [ ] `HERE_ROUTING_API_KEY` — chave privada usada apenas no Client API para calcular rotas/cotações.
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` — segredo JSON da service account no Driver API. Antes, activar Firebase Cloud Messaging API HTTP v1 no projecto `apptot-angola`; a service account e a role `roles/firebasecloudmessaging.admin` já estão registadas como configuradas. Guardar o JSON somente como variável secreta no Coolify.
- [ ] `DRIVER_DOCUMENT_RETENTION_DAYS` — **decisão pendente do proprietário**. Definir período aprovado antes de activar a purga automática; não inventar valor. Sem a variável, os documentos não são automaticamente expirados/purgados.
- [ ] `API_RATE_LIMIT_LIMIT` e `API_RATE_LIMIT_TTL_MS` — opcionais; defaults actuais 120 pedidos por rota/IP em 60.000 ms.
- [ ] `TRUST_PROXY_HOPS` — definir conforme o número real de proxies entre cliente e API. Não adivinhar: `0` é o default e, atrás do proxy, pode fazer todos os clientes parecerem o mesmo IP. Rate limit usa memória por processo; não escalar réplicas sem store partilhado ou decisão explícita sobre limites independentes.
- [ ] Rever portas host `ADMIN_API_HOST_PORT`/`CLIENT_API_HOST_PORT`/`DRIVER_API_HOST_PORT` se forem publicadas; defaults Compose 3000/3001/3004. Evitar conflitos e preferir encaminhamento dos domínios pelo proxy Coolify às portas internas 3000/3001/3004.

### C. Associar domínios e HTTPS

Configurar no serviço correspondente o domínio final e a porta interna do container (portais e landings: 80; APIs: Admin 3000, Client 3001, Driver 3004). Confirmar DNS e certificado HTTPS no Coolify.

- [ ] `landing-page`: domínio institucional principal.
- [ ] `landing-frota`: domínio/subdomínio aprovado para a página de frota.
- [ ] `admin-portal` e `admin-api`: domínios HTTPS finais; manter o portal e API no mesmo site (mesmo domínio registável e HTTPS) para o cookie de refresh `SameSite=Strict`.
- [ ] `client-portal` e `client-api`: domínios HTTPS finais; API também serve configurações públicas de mapa.
- [ ] `driver-portal` e `driver-api`: domínios HTTPS finais; validar WebSocket/WSS no domínio da Driver API.
- [ ] Rever `ALLOWED_ORIGINS` depois de fechar os domínios; não reutilizar literalmente os exemplos antigos do guia.
- [ ] HERE: incluir os domínios finais permitidos nas restrições da chave pública e rever quota.

### D. Aplicar migrations antes de actualizar as APIs

- [ ] Conferir backup e identificar a base alvo antes de qualquer comando.
- [ ] Consultar o estado de migrations Prisma na base de produção e aplicar somente migrations pendentes, pela ordem do Prisma, usando o job `migrate` do Compose (`docker compose -f docker-compose.prod.yml run --rm migrate`, ou execução equivalente de one-off release command no Coolify contra o mesmo ambiente).
- [ ] Não executar `prisma db push`. Não iniciar rollout das APIs se o job de migrations falhar.
- [ ] Confirmar especialmente a prontidão da migration `20261017130000_private_driver_documents`: a validação local encontrou dois documentos legados inválidos e fez rollback sem alterar os dados. Inspeccionar/regularizar esses registos com procedimento aprovado e backup antes de repetir em produção.
- [ ] Verificar o resultado e `prisma migrate status`. As migrations no repositório incluem `20261015220000_driver_fcm_tokens`, `20261017110000_normalize_service_fee_types`, `20261017130000_private_driver_documents` e `20261018100000_admin_auth_sessions`; aplicar apenas as ainda pendentes, junto com quaisquer outras que o estado da base indicar.

### E. Rollout e verificações após o Deploy

- [ ] Iniciar/actualizar o stack depois de migrations aprovadas; conferir healthchecks `/health` das três APIs (200) e estado saudável da base.
- [ ] Verificar acesso HTTPS às três landings/portais e endpoints públicos das APIs; confirmar CORS para origens permitidas e bloqueio de origens não permitidas.
- [ ] Entrar no painel admin, renovar sessão e terminar sessão; confirmar cookie seguro e acesso API. Verificar uploads e confirmar que persistem no volume `admin_uploads`.
- [ ] Verificar cotações/rotas HERE e mapas sem expor `HERE_ROUTING_API_KEY`; validar Socket.IO do motorista por WSS.
- [ ] Confirmar rate limit com resposta HTTP 429 em excesso controlado e headers; conferir IP do cliente real com `TRUST_PROXY_HOPS` configurado.
- [ ] Com credencial Firebase configurada, verificar registo de token e uma notificação de teste; não declarar push funcional só por a API iniciar.
- [ ] Confirmar scheduler de retenção sem erro e comportamento de documentos com/sem legal hold, somente depois de aprovar `DRIVER_DOCUMENT_RETENTION_DAYS`.
- [ ] Monitorizar logs e erros, confirmar persistência/backup e registar PASS/FAIL/BLOCKED com data, revisão implantada e migrations aplicadas. Manter procedimento de rollback da imagem/revisão e de recuperação da base documentado.

### Pendências conhecidas antes da produção

1. Definir `DRIVER_DOCUMENT_RETENTION_DAYS`.
2. Fechar os domínios finais e `ALLOWED_ORIGINS`.
3. Confirmar topologia do proxy para `TRUST_PROXY_HOPS` e decidir escala (rate limit em memória por réplica).
4. Activar FCM HTTP v1 e criar/guardar o JSON secreto no Coolify.
5. Resolver/avaliar os dois documentos legados que bloqueiam a migration de documentos privados antes de aplicá-la.
6. Fazer backup de produção e executar/validar migrations no alvo correcto antes do rollout.
