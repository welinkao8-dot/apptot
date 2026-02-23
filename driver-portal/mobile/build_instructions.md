# Instruções de Build - App TOT Driver (Mobile)

Este documento registra as configurações críticas e soluções aplicadas para compilar o aplicativo Android, superando limitações de ambiente e incompatibilidades de dependências.

### 🛠️ Configuração do Java e Toolchain

1.  **JDK Compatível**: O build **falha** com o Java 24. Usamos o JDK 21 do Android Studio: `C:\Program Files\Android\Android Studio\jbr`.
    *   **Variável**: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
2.  **Toolchain Fix**: Para evitar o erro `Cannot find a Java installation matching {languageVersion=17}`:
    *   **gradle.properties**: Desativamos o auto-download e definimos o caminho manual:
      ```properties
      org.gradle.java.installations.auto-download=false
      org.gradle.java.installations.paths=C:/Program Files/Android/Android Studio/jbr
      ```

2.  **Caminho do Projeto (Encoding)**: O nome do usuário do Windows contendo um acento (`Zoé`) quebra as ferramentas de build do Android.
    *   **Solução**: O build **deve** ser realizado em uma pasta com caminho ASCII simples, como `C:\apptot\mobile_build`.

## 📦 Configurações do Mapbox

O SDK Mapbox exige tokens específicos para download e inicialização:

*   **Secret Token (`gradle.properties`)**: `MAPBOX_DOWNLOADS_TOKEN` deve conter o token `sk.eyJ1...`. Isso permite que o Gradle baixe os arquivos binários do SDK.
*   **Public Token (`strings.xml`)**: O token `pk.eyJ1...` deve estar presente para que os mapas sejam renderizados no app.

### Correções Aplicadas no `build.gradle` e `settings.gradle`:
Para evitar erros de "Duplicate Class" (Classes Duplicadas) e repositórios não encontrados:
1.  **Repositório Mapbox**: Adicionado ao bloco `allprojects` no `build.gradle` da raiz do Android.
2.  **Estratégia de Resolução**: Forçadas as versões `24.2.0` para `com.mapbox.common:common` e `com.mapbox.common:okhttp` no `app/build.gradle` para resolver conflitos de dependências internas.

## 🚀 Como Compilar

1.  Sincronize o código para a pasta segura:
    ```powershell
    robocopy "." "C:\apptot\mobile_build" /MIR /XD node_modules .git .gradle android/.gradle android/app/build
    ```
2.  Acesse a pasta segura e instale dependências:
    ```powershell
    cd C:\apptot\mobile_build
    npm install --legacy-peer-deps
    ```
3.  Execute o build do APK:
    ```powershell
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    cd android
    ./gradlew assembleDebug --no-daemon
    ```

## ⚠️ Problemas Comuns e Soluções

*   **Cannot find module '@react-native-community/cli'**: Ocorre se o `npm install` falhar ou se houver corrupção no cache. Limpe o `node_modules` e instale novamente.
*   **Missing react-native-worklets**: Algumas versões do `react-native-reanimated` exigem esta biblioteca explicitamente. Instale via `npm install react-native-worklets`.
*   **Duplicate Class**: Geralmente causado pelo Mapbox injetando múltiplas versões do `okhttp`. Resolvido via `resolutionStrategy` no `app/build.gradle`.
