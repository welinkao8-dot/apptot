# Plano 02 — conclusão da implementação (2026-10-18)

## Resultado

A implementação e a cobertura automatizada verificável do Plano 02 estão concluídas. O aceite operacional final permanece condicionado a configuração dos endpoints reais no GitHub Actions, teste do handshake WSS no reverse proxy de teste e validação física do mapa e das jornadas em aparelhos. Nenhum valor de URL foi inventado.

## Trabalho fechado

- O bridge HERE tem testes de callback `onMapReady` atualizado, buffering antes de READY, flush após READY, reset, clear e retomada de comandos.
- RideFlow e DeliveryFlow descartam respostas antigas de pesquisa depois de limpar o campo. A classificação de falhas de busca, retry, fallback por coordenadas, validação de localizações, consentimento GPS, pickup manual e validação de `deliveryInfo` ficam cobertos pela implementação e testes registados no plano.
- Client API inclui a informação persistida de pagamento na leitura de uma viagem. Após reconectar, os fluxos cliente recuperam viagens ativas e também consultam a viagem conhecida para detectar pagamento confirmado quando o evento Socket.IO se perdeu.
- Driver mobile usa `TOT_DRIVER_SOCKET_URL` independente de `TOT_DRIVER_API_URL`. Configuração de release e workflow GitHub exigem endpoint de socket HTTPS/WSS; localhost fica limitado a debug. Removido comentário antigo que sugeria configurar manualmente ADB reverse.
- Histórico não inventa taxas/recibos e distingue falha de carregamento de lista vazia; os detalhes e limites estão na nota do Obsidian.

## Evidências

- `client-portal/mobile`: `npm test -- --runInBand` — 15 suites, 122 testes aprovados.
- `driver-portal/mobile`: `npm test -- --runInBand` — 23 suites, 125 testes aprovados.
- Client API, serviço de trips: 12 testes aprovados, incluindo os campos de pagamento persistidos.
- Testes da bridge HERE, URLs e workflow foram incluídos nas suites mobile acima.

## Configuração posterior

No GitHub Actions, configurar como Variables, com valores fornecidos para os ambientes de teste/produção:

- `TOT_CLIENT_API_URL`
- `TOT_CLIENT_SOCKET_URL`
- `TOT_DRIVER_API_URL`
- `TOT_DRIVER_SOCKET_URL`

`MAPBOX_DOWNLOADS_TOKEN` permanece Secret para dependências Android. A configuração real e a disponibilidade do proxy ainda não foram verificadas.

## Gates restantes

- Testar handshake Socket.IO/WSS no reverse proxy de teste.
- Verificar em telefone o carregamento HERE, pins/polyline, viewport e bottom sheet, rotação/resume, rede fraca e fallback/retry.
- Testar permissões GPS e definições do sistema em Android/iOS.
- Executar jornada completa de corrida e entrega com cliente e motorista em dois aparelhos.

Não foi criado APK, feito deploy, alterado Coolify ou declarado teste físico. As caixas no Obsidian distinguem implementação automatizada dos gates acima. A origem do progresso fica em `PLANS/Progress.md` e `PLANS/Plano 02 - Cliente mapa e cotação - 2026-10-15.md` no TOT Vault.
