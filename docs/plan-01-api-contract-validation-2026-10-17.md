# Plano 01 — matriz de contratos HTTP e evidências — 2026-10-17

Esta matriz liga as fronteiras de entrada mais sensíveis às regras implementadas e à evidência automatizada. Os endpoints são protegidos por JWT e papel quando indicado; o `sub` autenticado é a fonte de identidade para recursos do utilizador.

| Área | Contrato validado | Falha esperada | Evidência |
|---|---|---|---|
| Admin — criação/edição de serviços | DTO estrito; tarifas numéricas entre 0 e DECIMAL(10,2); `platform_fee_type` em `percentage`/`fixed`; `routing_mode` reconhecido e compatível com veículo; rejeita `id`, `updated_at` e campos desconhecidos | HTTP 400 antes de chamar o service ou persistência | `apps/admin-api/src/service-config.dto.spec.ts`, `apps/admin-api/test/app.e2e-spec.ts` |
| Admin — motoristas, clientes, corridas, pagamentos, faturas e auditoria | Listas limitadas por paginação; filtro enum permitido; pesquisa limitada; IDs de recursos UUID; repetição e chaves desconhecidas recusadas; mutações exigem admin | HTTP 400 para entrada inválida; HTTP 401/403 para autenticação/papel | `apps/admin-api/test/app.e2e-spec.ts`, `apps/admin-api/src/admin-api.controller.spec.ts` |
| Cliente — cotação e pedido | Origem/destino e coordenadas válidas em Angola; entrega exige destinatário/volume; cliente não define dono nem preço; quote única, válida e do cliente autenticado | HTTP 400/403 sem roteamento ou gravação indevida | `apps/client-api/test/app.e2e-spec.ts`, `apps/client-api/src/quotes/quotes.service.spec.ts`, `apps/client-api/src/trips/trips.service.spec.ts` |
| Cliente — pesquisa de locais | Autosuggest permite apenas `q`, `lat`, `lng`; parâmetros repetidos, desconhecidos e coordenadas não numéricas são recusados; latitude/longitude são fornecidas juntas | HTTP 400 antes da chamada HERE | `apps/client-api/test/app.e2e-spec.ts`, `apps/client-api/src/locations/locations.service.spec.ts` |
| Motorista — perfil, documentos e localização | Perfil derivado do JWT; documentos aceitam JPEG/PNG/WebP com base64 e assinatura real, até 8 MiB por imagem, só em estado de cadastro permitido; localização HTTP e eventos Socket.IO usam DTOs estritos | HTTP 400/403, sem transação em imagem inválida | `apps/driver-api/test/app.e2e-spec.ts`, `apps/driver-api/src/auth/driver-document-validation.spec.ts`, `apps/driver-api/src/trips/dto/update-driver-location.dto.spec.ts`, `apps/driver-api/src/rides/rides.gateway.spec.ts` |
| Serviço interno admin → motorista | Token interno obrigatório; `driverId` UUID e estado permitido | HTTP 403/400 sem emissão Socket.IO | `apps/driver-api/test/app.e2e-spec.ts`, `apps/driver-api/src/driver-api.dto.spec.ts` |
| Motorista — pagamento | Motorista só lê pagamento da viagem atribuída; confirmação de numerário exige viagem concluída, valor igual ao fare persistido, pagamento pendente e confirmação idempotente | HTTP 401/403/400; sem confirmação concorrente duplicada | `apps/driver-api/test/app.e2e-spec.ts`, `apps/driver-api/src/payments/payments.service.spec.ts`, harness PostgreSQL abaixo |

## Evidência integrada de 17/10/2026

- Admin e2e: 25/25.
- Cliente e2e: 35/35.
- Motorista e2e: 24/24.
- Backend Nest: 42 suites, 409 testes.
- Build Nest de admin-api, client-api e driver-api: sucesso.
- PostgreSQL 15 descartável: duas execuções simultâneas de migrations; migração de documentos válidos; rollback preserva dados legados inválidos; quote idempotente e preço imutável; limite de uma corrida ativa por cliente; uma aceitação entre motoristas concorrentes; corridas cancel/start e cancel/accept com um único vencedor; finish e cobrança repetidos idempotentes; uma fatura, um pagamento e um registo de auditoria persistidos.

## Compatibilidade e limites conhecidos

- Aplicações móveis ainda enviam `userId` em algumas rotas antigas de histórico/estatísticas. A API mantém esses caminhos por compatibilidade e deriva o proprietário sempre do JWT; o parâmetro de rota não concede acesso.
- Cotações parciais mantêm o formato atual de array consumido pelo mobile: apenas serviços com rota válida são retornados. Cada quote agora inclui `unavailableServices` com o modo/serviço indisponível e motivo genérico. Se nenhum modo produzir rota, a API responde 503.
- **Decisão de 18/10/2026:** purga automática de documentos de motorista fora do requisito aprovado. Não configurar `DRIVER_DOCUMENT_RETENTION_DAYS`; manter os documentos guardados. A rotina técnica opcional não deve ser activada sem pedido explícito do proprietário.
- Este relatório não valida credenciais HERE/Firebase, domínio/CORS real, Coolify, APK ou execução no telefone.

## Inventário de fronteiras

- Admin query params: `GET /admin/drivers` (`page` 1–100000, `limit` 1–100, `status` enum, `search` até 120 chars); `/clients` (page/limit/search); `/clients/:id/trips` e `/drivers/:id/trips` (UUID e page/limit); `/trips` (page/limit, status enum e search); `/invoices` (page/limit, type e search); `/payments` (page/limit, status e search); `/logs` (page/limit/action/target/search). Todos rejeitam chaves desconhecidas e valores repetidos/não escalares; IDs admin são UUID. As demais rotas admin não aceitam filtros.
- Admin bodies: `services` e `configs` usam DTO de tarifa; status de motorista/cliente e categoria de veículo usam enums/limites; admin upload aceita um raster até 5 MiB, verifica assinatura do arquivo e cria nome aleatório. `approve`, `delete` e leituras não aceitam body.
- Cliente bodies: autenticação usa DTOs de telefone/password/nome/email; quote exige categoria, endereços e coordenadas em Angola, e campos de entrega quando aplicável; `POST /trips` aceita apenas `quoteId`. Histórico aceita `limit`, `status`, `month`, `year`, `category` e `page` validados. `autosuggest` aceita `q`, `lat`, `lng`; reverse geocode requer coordenadas numéricas dentro da região suportada.
- Motorista bodies: auth usa DTOs próprios; `update-docs` exige três data URIs válidas e valida também bytes (JPEG/PNG/WebP, até 8 MiB cada); `trips/location` valida coordenadas e metadados; `/trips` cria para o proprietário autenticado a partir de quote; token FCM tem DTO próprio. Socket.IO valida cada evento com DTO estrito e deriva ator da sessão JWT.
- Admin e motorista exigem papel `admin`/`driver` nas rotas privadas; cliente exige papel `client`; `notify-driver-status` usa token interno e UUID em vez de identidade enviada livremente.

`unavailableServices` em cada quote válida lista os serviços/modos cuja rota falhou com motivo genérico; não expõe erro HERE nem credenciais.
