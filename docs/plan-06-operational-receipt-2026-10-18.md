# Plano 06 — recibo operacional no app cliente — 18/10/2026

## Estado

**Concluído no escopo confirmado pelo proprietário:** recibo operacional, não fiscal, que o cliente pode gerar no app a partir do histórico e guardar, partilhar ou imprimir pelo menu nativo do dispositivo.

A clarificação de 18/10/2026 substitui o bloqueio fiscal registado no levantamento inicial: o app não emitirá factura fiscal. Certificação AGT, séries fiscais, impostos e integração de facturação ficam fora deste escopo.

## Implementação

- O modal de detalhes no histórico do cliente agora identifica o documento como **“Documento operacional · não fiscal”** e oferece **“Guardar”**. No navegador, o utilizador pode escolher guardar como PDF ou imprimir.
- O PDF operacional do app cliente é criado localmente sob pedido após consulta actual ao servidor e confirmação do pagamento. A folha nativa permite guardar, partilhar ou imprimir.
- O PDF contém referência da viagem, tipo/estado, data de conclusão (com fallback para criação), origem, destino, valor e estado do pagamento. A referência usa o ID existente; não se cria série fiscal nem número sequencial.
- A geração é bloqueada se a corrida não estiver concluída ou se o pagamento não tiver estado confirmado e `confirmed_at`. O valor vem do pagamento persistido pelo servidor.
- Só uma viagem concluída com pagamento confirmado recebe o título “RECIBO OPERACIONAL”. Estados sem confirmação não geram recibo. Endereços são escapados antes de compor o HTML do PDF.
- Dependências nativas adicionadas: `react-native-html-to-pdf` 1.3.0 e `react-native-share` 12.3.1. O autolinking reconhece Android e iOS.
- O backend cria o registo operacional na transacção de confirmação; a API admin expõe o estado de pagamento. Não houve migration nem alteração de dados históricos. O PDF é gerado sob pedido no cliente/painel e não é armazenado pelo servidor.

## Verificações

- RED/GREEN dos testes de resumo, HTML seguro, estado do pagamento e exportador PDF/partilha.
- Suite completa do cliente: **16 suites, 133 testes aprovados**.
- Teste do `HistoryScreen` cobre abrir o recibo do registo seleccionado e chamar o exportador.
- Transformação Babel de `HistoryScreen.js`: passou.
- `npx react-native config`: confirmou autolinking de `react-native-html-to-pdf` e `react-native-share` para Android e iOS.
- ESLint não executável: o projecto móvel não tem ficheiro de configuração ESLint; nenhuma configuração foi criada.
- `npm install` reportou 81 vulnerabilidades na árvore actual (2 baixas, 14 moderadas, 63 altas, 2 críticas). Não foi executado `npm audit fix` nem actualizada dependência fora do escopo.

## Gate restante

A geração nativa real, a folha de partilha, guardar e impressão ainda precisam de validação num dispositivo no gate final. Não foi gerado APK, instalado app em telefone, nem executado build nativo local. Esta pendência fica no Plano 05; não impede o fecho da implementação do Plano 06 conforme o escopo definido.

## Ficheiros principais

- `client-portal/mobile/src/screens/HistoryScreen.js`
- `client-portal/mobile/src/services/operationalReceiptExporter.js`
- `client-portal/mobile/src/utils/receiptSummary.js`
- `client-portal/mobile/package.json`


- `npm audit --omit=dev --audit-level=high`: a árvore de produção reportou **54 vulnerabilidades** (2 baixas, 13 moderadas, 37 altas e 2 críticas). Não foi aplicado `npm audit fix`; a actualização geral de dependências exige trabalho próprio, pois pode alterar versões fora do escopo do Plano 06.
## Correcção do fluxo: recibo somente após confirmação do servidor — 18/10/2026

A descrição acima foi corrigida após rever o percurso completo da corrida nos apps cliente e motorista, desde o pedido até à confirmação do pagamento. Ela estava errada ao permitir um PDF com pagamento pendente e ao afirmar que não houve mudanças de API/backend.

### Fluxo verificado e regra implementada

1. O cliente solicita a corrida; o servidor persiste a corrida como solicitada.
2. O motorista aceita e conclui a corrida; o backend persiste o valor final e cria o pagamento pendente. Concluir a corrida, por si só, não cria recibo.
3. O motorista confirma o pagamento em numerário; a API valida motorista atribuído, estado concluído e valor persistido. Dentro da transacção, o servidor confirma o pagamento (`status=confirmed`, `confirmed_at`) e cria idempotentemente o registo operacional.
4. Só depois de o servidor confirmar o pagamento o cliente ou o painel admin pode gerar o documento. Ambos consultam novamente o estado actual no servidor; a geração é bloqueada se faltar `confirmed_at` ou o estado confirmado.
5. O PDF é criado sob pedido. É um recibo operacional, não fiscal. No painel admin, a acção chama-se apenas **“Guardar”** e abre a impressão do navegador, onde se pode escolher “Guardar como PDF”.

O app cliente e o painel admin não confiam apenas no estado que ficou carregado no ecrã. A validação exige corrida concluída, pagamento confirmado e data de confirmação. A confirmação de numerário é validada pelo servidor; o fluxo do motorista consulta o pagamento persistido se a confirmação Socket.IO falhar.

### Alterações e evidências

- Backend motorista: conclusão deixa de criar antecipadamente linhas `ride_receipt`/`delivery_receipt`; a confirmação do pagamento cria o registo uma única vez. `createInvoice` exige pagamento confirmado e usa o valor persistido.
- API admin inclui a relação `trip_payment` nos detalhes da corrida.
- Painel admin e app cliente consultam novamente a corrida no servidor antes de gerar/guardar o documento.
- Testes: frontend admin 86; mobile cliente 16 suites/133; backend 45 suites/429. Builds Vite, Nest Admin API e Nest Driver API passaram. Admin API local respondeu HTTP 200.
- Não foram feitas migrations, alterações de dados históricos, deploy, Coolify, APK nem testes em telefone. Registos legados já existentes não foram reclassificados nem apagados.

Esta adenda é a descrição vigente do comportamento e substitui as afirmações anteriores deste relatório sobre recibo com pagamento pendente e ausência de mudanças no backend/API. A validação física de guardar/imprimir no dispositivo continua no gate final acordado.
