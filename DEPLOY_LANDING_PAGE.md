# Deploy da Landing Page (Estilo Admin)

Para fazer o deploy da Landing Page exatamente como fizeste com o Admin:

## Passo 1: Criar Aplicação
No Coolify, vai a **+ Add New Resource** -> **Public Repository** (ou GitHub App).

## Passo 2: Configuração Inicial
Preenche os campos conforme a imagem que enviaste, mas com esta alteração no **Base Directory**:

- **Repository URL:** `https://github.com/welinkao8-dot/apptot`
- **Branch:** `main`
- **Build Pack:** `Dockerfile`
- **Base Directory:** `landing-page`  <-- **MUITO IMPORTANTE: Muda de `/` para `landing-page`**

Clica em **Continue**.

## Passo 3: Configuração Final
Na próxima tela:
1. **Docker File Path:** Mantém como `Dockerfile` (ele vai procurar dentro da pasta `landing-page`).
2. **Domains:** Coloca o teu domínio (ex: `https://taxitot.com`).
3. **Variables:** Como disseste, **não precisas de nenhuma variável**. É estático.

Clica em **Deploy** e já está!

---
### Mobile (APKs)
Os APKs continuam a ser gerados no GitHub em **Actions**. Basta fazeres o `git push` e descarregar no fim do build.
