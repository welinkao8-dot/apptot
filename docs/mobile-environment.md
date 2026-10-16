# URLs dos apps mobile por ambiente

Os apps cliente e motorista aceitam URLs via variáveis de ambiente no bundle. O desenvolvimento local mantém os endereços de localhost como fallback; builds `release` exigem URLs HTTPS com domínio público.

## Variáveis

| App | Variável | Uso | Fallback de debug |
| --- | --- | --- | --- |
| Cliente | `TOT_CLIENT_API_URL` | API cliente | `http://localhost:3001` |
| Cliente | `TOT_CLIENT_SOCKET_URL` | Socket.IO cliente | `http://localhost:3004` |
| Motorista | `TOT_DRIVER_API_URL` | API e Socket.IO motorista | `http://localhost:3004` |

Configure os três valores como **GitHub Actions Variables** (Settings → Secrets and variables → Actions → Variables), sem adicionar URLs específicas do servidor ou segredos ao repositório. Por exemplo, os dois serviços cliente podem usar URLs HTTPS públicas diferentes ou rotas distintas do mesmo domínio. Configure apenas as variáveis usadas pela aplicação que será empacotada.

O job do motorista também recebe `MAPBOX_DOWNLOADS_TOKEN` de **GitHub Actions Secrets**, necessário para baixar dependências privadas do SDK Mapbox. O valor não deve ser salvo no repositório.

O workflow ativo `Mobile Test APKs` continua gerando APKs de debug e encaminha as variáveis opcionais acima. Sem variáveis configuradas, esses APKs mantêm os fallbacks locais. Builds Android `release` falham se faltar qualquer URL necessária ou se ela não usar HTTPS com domínio público. O bundle JavaScript também aplica essa validação em builds de produção.

## Build local

Defina as variáveis no ambiente do processo Gradle antes de executar o comando de release. Em PowerShell, por exemplo:

```powershell
$env:TOT_CLIENT_API_URL = 'https://api.example.com'
$env:TOT_CLIENT_SOCKET_URL = 'https://socket.example.com'
```

Para o app motorista, defina `TOT_DRIVER_API_URL`. A compilação local de release também exige as variáveis de assinatura já verificadas pelos projetos: `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. O caminho do keystore é local ao runner; armazene os dados sensíveis em GitHub Actions Secrets e prepare o arquivo do keystore no runner antes de chamar Gradle. Builds do app motorista também precisam de `MAPBOX_DOWNLOADS_TOKEN` para as dependências privadas do Mapbox.

Não é necessário configurar URL HTTP de produção nem habilitar cleartext em release. O manifesto Android do app cliente já usa cleartext somente em debug; o app motorista agora segue a mesma regra (`true` em debug, `false` em release).
