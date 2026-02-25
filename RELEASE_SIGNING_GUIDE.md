# Guia de Configuração de Segredos (TOTAL)

Já gerei as tuas chaves de assinatura binárias (.keystore) e os respetivos códigos Base64 no teu terminal local. Agora só precisas de criar estes 6 segredos no teu GitHub para o build de produção funcionar.

## Valores Prontos para Copiar

Vai ao teu repositório no GitHub -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.

| Nome do Segredo | Valor |
| :--- | :--- |
| `ANDROID_KEYSTORE_BASE64_CLIENT` | *Copia o conteúdo do ficheiro `client_base64.txt`* |
| `ANDROID_KEYSTORE_BASE64_DRIVER` | *Copia o conteúdo do ficheiro `driver_base64.txt`* |
| `ANDROID_KEYSTORE_PASSWORD` | `tot_password_2026` |
| `ANDROID_KEY_ALIAS_CLIENT` | `client-key-alias` |
| `ANDROID_KEY_ALIAS_DRIVER` | `driver-key-alias` |
| `ANDROID_KEY_PASSWORD` | `tot_password_2026` |

> [!NOTE]
> Os ficheiros `client-release.keystore` e `driver-release.keystore` foram criados na pasta raiz do teu projeto. **Guarda-os bem!** Se os perderes, não conseguirás atualizar o app na Play Store no futuro.

---
**Depois de adicionares estes segredos, podes fazer o `git push` e o Google Play aceitará o teu App Bundle assinado!**
