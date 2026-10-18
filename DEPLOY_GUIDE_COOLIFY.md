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

## 5. Checklist operacional de deploy — estado actualizado em 18/10/2026

Esta checklist regista os requisitos operacionais do rollout. O estado real do deploy de 18/10/2026 está em “Resultado do rollout Coolify — 18/10/2026”, no fim deste guia. Os domínios `taxitot.com` são exemplos antigos; usar os domínios já existentes no Coolify e confirmar os restantes antes de novas alterações.

### A. Preparar o recurso no Coolify

- [ ] Confirmar o repositório, branch/revisão aprovada, `Base Directory` `./` e Compose `./docker-compose.prod.yml`.
- [ ] Confirmar que os serviços Compose são reconhecidos: `db`, `migrate`, `admin-api`, `client-api`, `driver-api`, `admin-portal`, `client-portal`, `driver-portal`, `landing-page` e `landing-frota`.
- [~] Backup não realizado neste rollout por decisão explícita do proprietário, que confirmou não haver dados relevantes; o reset da base apagou o schema/dados anteriores. Para futuras releases com dados a preservar, manter backup/restore.
- [ ] Confirmar que `db` usa PostgreSQL 15 e que `DATABASE_URL` liga ao host Compose `db` (não `localhost`) com a base/utilizador correctos. Codificar caracteres especiais da password na URL.

### B. Configurar variáveis de ambiente no Coolify

Guardar os valores secretos directamente no gestor de variáveis do Coolify; nunca os copiar para Git, documentação ou conversa.

- [ ] `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_URL` — valores consistentes entre serviço `db`, APIs e job `migrate`.
- [ ] `JWT_SECRET` — segredo forte, igual nas três APIs.
- [ ] `INTERNAL_SERVICE_TOKEN` — segredo forte independente, igual em Admin API e Driver API para chamadas internas.
- [ ] `ALLOWED_ORIGINS` — origens exactas dos portais que chamam APIs, separadas por vírgula, com esquema e host, sem caminhos nem wildcard; usar os domínios finais HTTPS.
- [ ] `ADMIN_API_URL` — URL pública HTTPS da Admin API; também é usada para formar URLs públicas dos uploads e no build do portal admin.
- [ ] `CLIENT_API_URL`, `DRIVER_API_URL`, `DRIVER_API_SOCKET_URL` — URLs públicas HTTPS finais usadas pelos portais. Socket.IO deve funcionar por HTTPS/WSS.
- [x] `HERE_MAP_API_KEY` — chave pública configurada no Runtime do `client-api`; nunca usar aqui a chave privada de routing. Restrições HERE por origem/API não foram activadas nem validadas.
- [x] `HERE_ROUTING_API_KEY` — chave privada distinta configurada no Runtime do `client-api`; valor omitido.
- [x] `FIREBASE_SERVICE_ACCOUNT_JSON` — segredo JSON configurado no Runtime do `driver-api`; não registar o valor. A entrega real de notificações continua por testar.
- [x] Purga automática de documentos de motorista: fora da política e do escopo de deploy. Não configurar `DRIVER_DOCUMENT_RETENTION_DAYS`; os documentos devem permanecer guardados. Só alterar esta decisão mediante pedido explícito do proprietário.
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
- [x] Migrations aplicadas uma vez no primeiro rollout com reset autorizado, após `migrate deploy` retornar P3005; não repetir o reset. Para futuras releases, usar migrations incrementais e verificar o histórico.
- [x] Não foi executado `prisma db push`. O reset foi manual e específico para este banco sem dados a preservar; não repetir em futuros deploys.
- [x] A migration `20261017130000_private_driver_documents` foi aplicada no reset da base vazia. Os dois registos legados pertenciam ao schema anterior removido no reset; não foram inspeccionados nem preservados.
- [~] Reset terminou sem mensagem de falha e o login admin foi confirmado; `prisma migrate status` não foi consultado directamente.

### E. Rollout e verificações após o Deploy

- [~] `admin-api`, `client-api`, `driver-api` e `admin-portal` foram redeployados e aparecem `Running (unknown)`; não foi feita chamada directa aos healthchecks `/health`.
- [ ] Verificar acesso HTTPS às três landings/portais e endpoints públicos das APIs; confirmar CORS para origens permitidas e bloqueio de origens não permitidas.
- [~] Login no painel admin confirmado pelo proprietário; renovação/saída da sessão e persistência de uploads não foram verificadas.
- [ ] Verificar cotações/rotas HERE e mapas sem expor `HERE_ROUTING_API_KEY`; validar Socket.IO do motorista por WSS.
- [ ] Confirmar rate limit com resposta HTTP 429 em excesso controlado e headers; conferir IP do cliente real com `TRUST_PROXY_HOPS` configurado.
- [ ] Com credencial Firebase configurada, verificar registo de token e uma notificação de teste; não declarar push funcional só por a API iniciar.
- [x] Não activar nem validar purga automática de documentos de motorista; não faz parte do rollout aprovado.
- [ ] Monitorizar logs e erros, confirmar persistência/backup e registar PASS/FAIL/BLOCKED com data, revisão implantada e migrations aplicadas. Manter procedimento de rollback da imagem/revisão e de recuperação da base documentado.

### Pendências após o rollout de 18/10/2026

1. Confirmar `ALLOWED_ORIGINS`, topologia do proxy (`TRUST_PROXY_HOPS`) e configuração de escala/rate limit.
2. Validar directamente `/health` nas três APIs; Coolify apresenta `Running (unknown)`.
3. Fazer teste real de HERE, Socket.IO/WSS e FCM. Push real continua dependente de APK/dispositivo.
4. Trocar a senha temporária do administrador criado após o reset.
5. Não repetir o reset. Em deploys futuros com dados a preservar, fazer backup/restore verificável e aplicar migrations incrementais.

A purga automática de documentos de motorista foi retirada dos requisitos e pendências do plano. `DRIVER_DOCUMENT_RETENTION_DAYS` não deve ser configurada; manter os documentos guardados. A capacidade técnica existente só deve ser revista se o proprietário pedir explicitamente uma política de eliminação.

As antigas pendências de guardar JSON FCM, fazer o primeiro rollout e aplicar as migrations foram substituídas pelo resultado registado na secção 6. O backup não foi feito neste rollout, por decisão explícita do proprietário; a base foi limpa no reset autorizado.
## 6. Resultado do rollout Coolify — 18/10/2026

O proprietário confirmou o redeploy de `admin-api`, `client-api`, `driver-api` e `admin-portal`; os recursos aparecem `Running (unknown)`. Os logs apresentados de `client-api` e `admin-portal` indicam `Deployment is Finished`. O proprietário confirmou login no painel admin. O estado `unknown` não equivale a health-check HTTP validado.

### Configuração confirmada

- `driver-api`: `FIREBASE_SERVICE_ACCOUNT_JSON` como segredo Runtime.
- `client-api`: `HERE_ROUTING_API_KEY` (privada) e `HERE_MAP_API_KEY` (pública) em Runtime, com chaves distintas.
- `admin-portal`: `VITE_HERE_API_KEY` em Buildtime, Runtime desligado.
- Os valores secretos não devem ser copiados para documentação, Git ou conversa.

### Base de dados e migrations

O primeiro `npm run db:migrate:deploy` falhou com Prisma `P3005`: o schema existente não estava vazio e não tinha histórico de migrations Prisma. O proprietário confirmou que não havia dados relevantes a preservar e dispensou backup para este rollout. Foi executado uma única vez no Post-deployment do `admin-api`:

```sh
npx prisma migrate reset --force --schema libs/database/prisma/schema.prisma
```

O reset destruiu os dados/schema anteriores e recriou o schema aplicando as migrations. O proprietário confirmou depois que conseguiu iniciar sessão no painel. O comando de reset foi removido do Coolify. **Não repetir esse reset** em deploys futuros; usar apenas migrations incrementais e verificar o histórico da base. Não foi feito backup neste rollout, conforme decisão explícita do proprietário.

### Validações ainda pendentes

- Health-check HTTP `/health` directo para cada API; Coolify mostra `Running (unknown)`.
- Teste real de HERE, Socket.IO/WSS e entrega de push FCM num APK/dispositivo.
- Purga automática de documentos de motorista retirada dos requisitos; não configurar `DRIVER_DOCUMENT_RETENTION_DAYS` e manter documentos guardados, conforme decisão de 18/10/2026.
- Trocar a senha temporária do administrador criado após o reset.
- Não foi feito build de APK nem teste em telefone.
