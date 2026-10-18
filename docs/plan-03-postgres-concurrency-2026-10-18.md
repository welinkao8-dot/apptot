# Plano 03 — concorrência real em PostgreSQL (2026-10-18)

## Ambiente e isolamento

Executado `npm run test:plan01:postgres` no backend. O harness iniciou o seu próprio PostgreSQL 15.15 descartável, database `tot_test`, bind apenas a `127.0.0.1` e porta dinâmica; aplicou as migrations num schema criado para o teste. Não foi usado o container `tot_db`, o container local anterior, Coolify ou qualquer serviço de produção.

## Resultado

- Duas chamadas simultâneas de aceite por motoristas diferentes: exactamente uma fulfilled e uma rejected; trip terminou `accepted` com `driver_id` do vencedor.
- Cancelamento versus aceite e cancelamento versus início: em cada corrida, exactamente uma transição venceu e o estado final foi consistente.
- Quote idempotente e tarifa snapshot mantida após mudança de tarifa; regra de uma corrida activa por cliente.
- Jornada delivery completa, pagamento cash repetido idempotente, uma invoice e um pagamento durável.
- Migrations simultâneas e validações de backfill/rollback também passaram no ciclo completo.

O harness removeu apenas os dados criados para o teste, o container temporário próprio e a sua pasta temporária. O container PostgreSQL local já existente permaneceu intacto.

## Regra registada

Executar testes em ambiente local descartável sempre que possível. Produção, Coolify e serviços remotos ficam para uma fase posterior; as configurações e verificações restantes devem ser registadas sem serem aplicadas remotamente.
