# Plano 03 — ofertas push e abertura segura (2026-10-18)

## Alterações

- Ao tocar numa notificação de oferta, o app consulta `GET /trips/pending` autenticado e abre `RequestDetails` somente se a oferta ainda estiver pendente. Push antigo, aceite, cancelado ou erro de rede não abre uma oferta localmente armazenada.
- A Driver API revalida a oferta antes do envio FCM: mesmo motorista e viagem, oferta `offered`, prazo futuro e viagem `requested`. O payload expõe apenas `type` e `tripId`.
- Mantida deduplicação entre notificações push e eventos Socket.IO. O token fica associado ao motorista autenticado, é actualizado no refresh, removido no logout e eliminado após rejeição de token inválido pelo Firebase. O canal `trip_offers` é criado no arranque Android.

## Verificações

- Driver mobile: `npm test -- --runInBand` — 23 suites, 129 testes aprovados.
- Driver API: push, gateway e serviço de trips — 3 suites, 74 testes aprovados.
- Driver API: `npm run build driver-api` — Nest/webpack compilou com sucesso.
- Testes novos cobrem revalidação antes do push, oferta expirada/claimada, lookup de pending e navegação apenas para a oferta devolvida pela API.

## Limites

Plano 03 continua em curso. A concorrência de aceite passou depois em PostgreSQL 15 descartável. FCM ainda depende de configuração do ambiente; cenários Android foreground/background/processo encerrado, permissões e navegação precisam de aparelho. Não foi criado APK, feito deploy ou alterado Coolify.
