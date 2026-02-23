# Sistema de Build e Deploy

Este arquivo define as regras e o fluxo de build para o projeto **TOT**.

## Regras de Git
> [!IMPORTANT]
> **O Agente (AI) deve apenas realizar o COMMIT.**
> **O PUSH é de responsabilidade exclusiva do USUÁRIO.**

### Fluxo de Trabalho:
1. O Agente implementa as mudanças.
2. O Agente realiza o `git add .` e `git commit -m "descrição"`.
3. O Usuário revisa e realiza o `git push`.

## Processo de Build (Mobile)
O build do aplicativo mobile não é feito localmente. Ele é processado via **GitHub Actions**.

### Como obter o APK:
1. Após o `push` do usuário, o GitHub Actions inicia o build.
2. Uma vez concluído, o APK/Bundle fica disponível nos **Artifacts** ou **Releases** do repositório no GitHub.
3. O usuário deve baixar e instalar no dispositivo físico para testar mudanças nativas.

---
*Documento criado para evitar esquecimentos sobre o fluxo de deploy.*
