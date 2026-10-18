# Plano 15 — Mapa de procura e equilíbrio entre procura/oferta

## Planning header

- Goal: Mapa de procura e equilíbrio entre procura/oferta.
- Architecture: Apply the domain-specific architecture described in the sections below.
- Tech Stack: React/Vite admin, NestJS, Prisma, PostgreSQL; React Native client/driver apps where the plan touches mobile.
- Spec path: docs\admin-platform-capability-audit-2026-10-17.md; roadmap and constraints: docs\superpowers\plans\2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: direct project checkout, no worktree, no local APK build, no deployment, additive migrations with rollback, preserve history, apply server-side authorization and idempotency, and update Obsidian at each implementation phase.
- Task structure: numbered phases below are independently reviewable implementation tasks; accept each against the explicit criteria in this plan before moving on.

## Objetivo e inovação
Antecipar zonas e períodos com espera longa para coordenar mais motoristas e entregas. É uma inovação útil sem prometer inteligência artificial mágica: começa com histórico agregado, depois pode prever procura. O produto deve sugerir reposicionamento ou incentivo transparente, não alterar tarifa automaticamente nesta primeira versão.

## Arquitetura proposta
Agregar pedidos por célula geográfica e bloco de tempo, removendo identificação pessoal. Comparar pedidos, motoristas elegíveis/disponíveis, tempo até aceite, cancelamentos e ETA. Previsão apresenta intervalo de confiança e evidência; a equipa decide a ação.

## Fases
1. Definir janela/célula geográfica, retenção de dados e métricas que não reidentificam uma pessoa.
2. Criar baseline histórico por zona/horário e validação contra semanas futuras, sem modelo preditivo inicialmente.
3. Painel de mapa de calor com procura/oferta, envelhecimento do dado e confiança; ligar a recomendações de turno.
4. Introduzir previsão simples com backtesting, erro por zona e fallback para observação histórica.
5. Piloto com recomendações humanas e incentivo publicado por regra, orçamento máximo e vigência.
6. Só considerar integração de otimização de rotas após volume justificar custo e capacidade de frota estarem no cadastro.

## Critérios de aceitação
- Mapa não exibe coordenadas de cliente nem localização individual histórica.
- Recomendação explica quais dados e intervalo sustentam a previsão.
- Métrica de erro é reportada e o sistema não recomenda quando confiança é baixa.
- Incentivo e custo têm teto, aprovação e auditoria.
- Nenhum aumento dinâmico de preço é ativado implicitamente.

## Dependências, riscos e validação
Depende de zonas, histórico limpo, despacho e analytics. Risco de viés por áreas com pouca cobertura e de expor padrões de moradia/trabalho. Deve começar como painel agregado; Route Optimization oficial suporta restrições como horas, capacidades e balanceamento, mas só é opção após análise de custo e cobertura: https://developers.google.com/maps/documentation/route-optimization/overview


