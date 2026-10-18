# URLs dos apps mobile por ambiente

Os apps cliente e motorista usam os serviços de produção por padrão, inclusive em debug com Metro. As variáveis de ambiente podem substituir esses endereços quando for necessário testar contra uma API local. Builds `release` exigem URLs HTTPS com domínio público.

## Variáveis

| App | Variável | Uso | Padrão |
| --- | --- | --- | --- |
| Cliente | `TOT_CLIENT_API_URL` | API cliente | `https://api.taxitot.com` |
| Cliente | `TOT_CLIENT_SOCKET_URL` | Socket.IO servido pela Driver API | `https://driver-api.taxitot.com` |
| Motorista | `TOT_DRIVER_API_URL` | API motorista | `https://driver-api.taxitot.com` |
| Motorista | `TOT_DRIVER_SOCKET_URL` | Socket.IO motorista | `https://driver-api.taxitot.com` |

O workflow `Mobile Test APKs` fixa estes quatro endereços de produção. Para desenvolvimento local, as mesmas variáveis podem ser definidas na sessão que inicia o Metro e substituir os padrões; não são necessárias GitHub Actions Variables para os endpoints.

O job do motorista também recebe `MAPBOX_DOWNLOADS_TOKEN` de **GitHub Actions Secrets**, necessário para baixar dependências privadas do SDK Mapbox. O valor não deve ser salvo no repositório.

O workflow activo `Mobile Test APKs` gera APKs de debug apontados directamente para produção. Ao iniciar Metro sem variáveis, o bundle também aponta para produção. Para um teste local, defina as variáveis correspondentes para os endereços da API local antes de iniciar/reiniciar o Metro. Builds Android `release` falham se faltar qualquer URL necessária ou se ela não usar HTTPS com domínio público. O bundle JavaScript também aplica essa validação em builds de produção.

## Build local

Defina as variáveis no ambiente do processo Gradle antes de executar o comando de release. Em PowerShell, por exemplo:

```powershell
$env:TOT_CLIENT_API_URL = 'https://api.example.com'
$env:TOT_CLIENT_SOCKET_URL = 'https://socket.example.com'
```

Para o app motorista, defina `TOT_DRIVER_API_URL` e `TOT_DRIVER_SOCKET_URL` se precisar substituir o padrão. A compilação local de release também exige as variáveis de assinatura já verificadas pelos projetos: `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. O caminho do keystore é local ao runner; armazene os dados sensíveis em GitHub Actions Secrets e prepare o arquivo do keystore no runner antes de chamar Gradle. Builds do app motorista também precisam de `MAPBOX_DOWNLOADS_TOKEN` para as dependências privadas do Mapbox.

Não é necessário configurar URL HTTP de produção nem habilitar cleartext em release. O manifesto Android do app cliente já usa cleartext somente em debug; o app motorista agora segue a mesma regra (`true` em debug, `false` em release).
