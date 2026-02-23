# Mapbox Navigation SDK v3 - Master Documentation Index

Este documento serve como referência central para a implementação da interface de navegação nativa premium no AppTot.

## 1. Guias Gerais e Core
- [Link 1: Mapbox Navigation Guides](https://docs.mapbox.com/android/navigation/guides/) - Visão geral de todas as capacidades do SDK.
- [Link 8: Device Location](https://docs.mapbox.com/android/navigation/guides/device-location/) - Gestão de permissões e provedores de localização.
- [Link 9: Localization](https://docs.mapbox.com/android/navigation/guides/localization/) - Suporte a múltiplos idiomas e unidades de medida.
- [Link 26: Offline Maps](https://docs.mapbox.com/android/navigation/guides/advanced/offline/) - Como gerir navegação sem conexão de dados.

> [!TIP]
> **Arquitetura V3**: Diferente das versões anteriores, a V3 separa a Lógica (APIs) da Visualização (Views). Para cada componente visual (ex: Maneuver), existe uma API correspondente (ex: ManeuverApi) que processa os dados e uma View que os renderiza.

## 2. Componentes de UI (The "Uber" Look)
- [Link 10: UI Components Overview](https://docs.mapbox.com/android/navigation/guides/ui-components/) - Introdução aos blocos de construção da interface.
- [Link 11: Maps UI](https://docs.mapbox.com/android/navigation/guides/ui-components/maps/) - Integração do MapView com o Navigation SDK.
- [Link 12: Camera](https://docs.mapbox.com/android/navigation/guides/ui-components/camera/) - Uso de `NavigationCamera` e `ViewportDataSource` para seguimento automático.
- [Link 13: Route Line](https://docs.mapbox.com/android/navigation/guides/ui-components/route-line/) - Renderização via `MapboxRouteLineApi`. Requer `ANNOTATION_CONGESTION_NUMERIC` para trânsito.
- [Link 16: Maneuver View](https://docs.mapbox.com/android/navigation/guides/ui-components/maneuver/) - Instruções de topo. Utiliza `BannerInstructions`.
- [Link 21: Trip Progress](https://docs.mapbox.com/android/navigation/guides/ui-components/trip-progress/) - Painel inferior. API: `MapboxTripProgressApi`.
- [Link 20: Speed Limit](https://docs.mapbox.com/android/navigation/guides/ui-components/speed-limit/) - Indicador de limite de velocidade. API: `MapboxSpeedLimitApi`.

## 3. Fluxo de Navegação Turn-by-Turn
- [Link 27: Turn-by-Turn Overview](https://docs.mapbox.com/android/navigation/guides/turn-by-turn-navigation/) - Ciclo de vida completo da navegação.
- [Link 28: Build the Route](https://docs.mapbox.com/android/navigation/guides/turn-by-turn-navigation/build-the-route/) - Como solicitar rotas otimizadas.
- [Link 29: Route Progress](https://docs.mapbox.com/android/navigation/guides/turn-by-turn-navigation/route-progress/) - Observação de progresso em tempo real.
- [Link 30: Rerouting & Refresh](https://docs.mapbox.com/android/navigation/guides/turn-by-turn-navigation/rerouting-and-refresh/) - Lógica de desvio e atualização de trânsito.

## 4. Android Auto
- [Link 2: Android Auto Get Started](https://docs.mapbox.com/android/navigation/guides/androidauto/get-started/)
- [Link 3: Location Permissions](https://docs.mapbox.com/android/navigation/guides/androidauto/location-permission/)
- [Link 4: Free Drive](https://docs.mapbox.com/android/navigation/guides/androidauto/free-drive/)
- [Link 5: Search](https://docs.mapbox.com/android/navigation/guides/androidauto/search/)
- [Link 6: Route Preview](https://docs.mapbox.com/android/navigation/guides/androidauto/route-preview/)
- [Link 7: Active Guidance](https://docs.mapbox.com/android/navigation/guides/androidauto/active-guidance/)

## 5. Notificações para o Condutor
- [Link 31: Driver Notifications Overview](https://docs.mapbox.com/android/navigation/guides/driver-notifications/)
- [Link 32: Get Started with Notifications](https://docs.mapbox.com/android/navigation/guides/driver-notifications/get-started/)
- [Link 33: Slow Traffic Notifications](https://docs.mapbox.com/android/navigation/guides/driver-notifications/slow-traffic-notification/)
