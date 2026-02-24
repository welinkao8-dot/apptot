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
HERE_API_KEY=sua_chave_here
```

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
