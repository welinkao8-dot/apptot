# Plano 04 — implementação de API e verificação local — 2026-10-18

## Trabalho concluído

- Sessão admin isolada: access JWT de 15 minutos apenas em memória; refresh token opaco guardado por hash na tabela `admin_auth_sessions`; cookie HttpOnly/SameSite=Strict; origem validada em login, refresh e logout; refresh rotativo e revogável. Criada migration aditiva, sem aplicação em produção.
- Modelo de sessão documentado pelo código: token de acesso pode continuar válido até 15 minutos após logout; o refresh é revogado no servidor. A configuração de produção ainda deve usar HTTPS, origem exacta permitida e a API e painel no mesmo site para o cookie Strict.
- Cliente Axios próprio valida URL, não usa defaults globais, normaliza falhas HTTP/rede e renova a sessão uma vez. O frontend de produção requer `ADMIN_API_URL` como URL da Admin API.
- Socket usa o access token actual ao (re)conectar, actualiza dados depois de reconectar e remove listeners ao sair. LiveOps mantém actualização periódica como fallback.
- Tarifas: acrescentado `POST /admin/services/:id/quote-preview`, protegido por role admin. A API pede uma rota HERE real de teste e devolve distância, duração, preço actual e proposto sem criar viagem/cotação. O formulário invalida prévias antigas e exige preview mais confirmação antes de gravar uma alteração de preço.
- A alteração de preço e respectiva auditoria passaram a partilhar a mesma transação. O registo contém actor e valores anteriores/novos. Criação, substituição e remoção de imagens registam o ID do asset gerido sem guardar a URL completa no log.
- A imagem enviada mostra progresso; o upload continua limitado a JPEG/PNG/WebP verificados pelos bytes, com limite de 5 MiB e nome UUID. Respostas estáticas recebem `nosniff`, CSP restritiva e política same-site; imagens antigas sem referência são removidas.
- Extracted o provider HERE para `libs/routing`, para Admin API e Client API partilharem o serviço sem uma depender do código interno da outra.
- Teste de preço confirma que uma cotação nova lê a tarifa alterada e que a cotação anterior conserva o snapshot. A simulação é somente prévia e não grava quote.

## Evidências locais

- Backend unitário: 44 suites, 421 testes aprovados.
- Admin API E2E: 26/26 aprovados, incluindo role admin, validação da rota/preço e recusa de coordenadas inválidas no preview.
- Admin frontend: 79/79 testes aprovados após remover Testing Library a pedido do utilizador.
- Builds Nest de Admin API e Client API aprovados; build Vite aprovado. O bundle principal continua acima de 500 kB (aprox. 1.21 MB).
- `npx prisma validate` aprovado.
- `npm run test:deployment-config`: 3/3 aprovados.
- `npm run test:plan01:postgres`: PostgreSQL 15 descartável passou migrations, concorrência, backfill/rollback, quote e fluxo de pagamento. O harness limpou os dados de teste.
- `git diff --check` não reportou erros de whitespace; Git apenas avisou sobre a conversão de LF para CRLF em ficheiros já modificados.

## O que fica para validação manual do utilizador

- Na validação de 18/10, o plano estava em 33/36 antes do gate integrado. O gate PostgreSQL Admin API → Client API foi concluído no aditamento abaixo; estado actual: 34/36 (94%) antes do aceite manual do utilizador registado no aditamento final.
- Abrir o painel autenticado e percorrer os ecrãs, incluindo o preview de tarifa. A verificação visual de navegação, teclado/focus e tamanhos responsivos fica para o utilizador.
- Confirmar timestamps independentes em todas as páginas que carregam dados; LiveOps, Dashboard e localização já expõem timestamps, mas o painel inteiro não foi percorrido visualmente.
- Confirmar a rota HERE com a chave e o serviço locais configurados; os testes automatizados usam provider simulado e não enviaram coordenadas para a HERE.

## Fora da execução local

- Nenhuma migration foi aplicada no Coolify, nenhuma configuração/deploy de produção foi alterada, nenhum APK foi criado e não houve teste em telefone.
- A biblioteca Testing Library, o teste DOM, helper e guia foram removidos do frontend admin conforme pedido; `npm test` e build Vite passaram depois da remoção. A navegação visual do painel fica para o utilizador.
- Antes de produção, configurar `ADMIN_API_URL`, `VITE_API_URL`, origens permitidas e HERE Routing, aplicar a migration com o procedimento de backup e verificar o cookie Secure/HTTPS no domínio final.
- A auditoria anterior de `npm audit --omit=dev` encontrou 10 vulnerabilidades (5 moderadas e 5 altas) nas dependências de produção existentes; não foi executado `npm audit fix`.

## Gate integrado Admin API → Client API com PostgreSQL — 18/10/2026

O harness PostgreSQL 15 descartável executou o fluxo pelos serviços reais das duas APIs: criou quote antiga a partir da tarifa inicial, alterou a tarifa via `AdminApiService.updateServiceConfig` com admin actor, e criou quote nova via `QuotesService.create` com rota determinística de 1.8 km e 7 minutos. A quote nova foi calculada em 886 Kz e guardou os valores novos no snapshot. A quote antiga preservou os 1.234,50 Kz e o snapshot inicial. A auditoria persistiu actor e valores antes/depois. `npm run test:plan01:postgres` passou por inteiro; o harness removeu o container e os dados temporários.

Naquele checkpoint, o Plano 04 estava em 34/36 itens (94%), antes do aceite manual registado no fim deste relatório. Produção/Coolify, APK e telefone continuam fora desta etapa.

## Aceite manual do utilizador — 18/10/2026

O utilizador confirmou que o painel abriu sem erros e está a funcionar bem. Os dois critérios visuais pendentes foram aceites manualmente; o Plano 04 fica em 36/36 (100%). Esta é uma validação do utilizador, sem alegar uma auditoria automatizada de teclado ou de todos os estados em cada página.

A migration local `admin_auth_sessions` foi aplicada para permitir login. A migration de documentos privados continua pendente: parou ao encontrar dois documentos legados inválidos e preservou-os. Nenhum dado desses documentos foi alterado.