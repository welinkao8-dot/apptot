# Auditoria de capacidades do TOT e planos de evolução — 17/10/2026

## Âmbito

Leitura do schema Prisma, Admin API, páginas administrativas, fluxos existentes nos apps cliente/motorista e documentação atual. Esta é uma avaliação de capacidades encontradas no código/documentação; não declara que todos os casos funcionam em produção. Não foram executados testes, builds, deploy nem validação em aparelho neste trabalho documental.

## O que já existe no painel

O painel atual já tem base operacional: login, visão geral/indicadores, operação ao vivo, lista e revisão de motoristas, clientes e respetivo histórico, serviços e tarifas, corridas, registos de faturas/recibos, pagamentos em numerário/conciliação, auditoria e uma tela de configurações.

No backend há endpoints administrativos para estatísticas, analytics, motoristas/localização/documentos/estado, clientes/estado, serviços, corridas, faturas, pagamentos, configurações de leitura, logs e upload. O controller aplica autenticação e papel único admin às rotas da classe. Existem transições de corrida, ofertas de motorista e registo separado de pagamento cash confirmado/pendente, implementados em planos anteriores.

## Lacunas confirmadas no código/schema

### 1. Acesso interno
Existe um papel amplo admin e não foi encontrada gestão de utilizadores administrativos, cargos e permissões por ação. Isso torna arriscado dar acessos diferentes à operação, suporte e financeiro.

### 2. Veículos
O banco guarda vehicle_category no motorista, não um cadastro de veículos, matrícula, modelo ou associação com histórico. O app do motorista procura rótulos de modelo/matrícula, mas sem origem persistida no backend esses valores podem ser genéricos. O painel só altera categoria do veículo do motorista.

### 3. Aprovação e validade documental
Há campos para documentos básicos e estados de motorista, mas não um fluxo versionado completo por documento, validade, expiração, decisão/revisor e regra central de elegibilidade ligada ao veículo.

### 4. Financeiro
O financeiro **não está totalmente ausente**: existe pagamento cash por viagem, confirmação pelo motorista, autor/data, auditoria e leitura administrativa. Porém falta um ledger imutável, saldo líquido do motorista, lançamentos reais de comissão, pagamentos a motoristas, ajustes, reembolsos e integração digital com reconciliação. O valor da corrida/fatura não deve ser apresentado como valor recebido ou ganho líquido.

### 5. Faturas/recibos
Existem registos chamados invoices e campos para PDF, mas não há evidência suficiente para concluir que todo documento é gerado, numerado e fiscalmente conforme em Angola. Emissão, pagamento confirmado e documento fiscal têm de ser estados separados.

### 6. Despacho e operação ao vivo
Há distribuição/ofertas no fluxo de corridas e visualização ao vivo. As rotas administrativas identificadas não mostram comandos completos de atribuição manual, reatribuição, fila SLA e escalonamento operacional.

### 7. Entregas
Os dados do pacote/destinatário ficam em delivery_info JSON e partilham o ciclo geral de viagem. Não foi encontrado modelo explícito de etapas/tentativas, PIN/prova, recolha, falha e devolução.

### 8. Apoio, zonas, turnos e saúde operacional
Não foram encontrados módulos de tickets/incidentes, zonas de serviço, calendário operacional de turnos, manutenção, nem painel de estado para filas/provedores/jobs. Existe a tabela driver_shifts, mas sem módulo administrativo completo identificado.

### 9. Notificações
Há tokens FCM e envio para motoristas. Não foi encontrada outbox de eventos com estado/tentativas nem gestão unificada dos dispositivos dos clientes, preferências e falhas/retries visíveis.

### 10. Configuração e dados de decisão
A documentação do painel regista que as configurações globais são informativas/read-only, enquanto tarifas por serviço persistem. As métricas existentes são úteis, mas não formam ainda um catálogo financeiro/operacional com fórmulas, exports, SLAs e alertas claramente definidos.

## O que isto significa na prática

As lacunas não provam que o app inteiro esteja quebrado. Significam que o produto ainda não tem os controles necessários para crescer com equipa, frota, dinheiro, entregas e incidentes de forma auditável. As maiores exposições são: atribuir motorista sem identificar o veículo efetivo; dar um papel admin amplo a toda a equipa; não reconciliar valor bruto, comissão, cash recebido e líquido devido; chamar fatura a um documento sem prova de validade fiscal; e não ter uma fila humana para atrasos, falhas e incidentes.

## Ideias novas propostas

- **Mapa de procura/oferta:** previsão agregada por área/horário que sugere reposicionamento ou turnos; mostra confiança e nunca rastreia cliente individual.
- **Despacho assistido:** mostra ao operador os candidatos elegíveis, ETA de recolha, frescura de localização e razão de exclusão antes de sugerir atribuição.
- **Entrega com prova adaptativa:** PIN de uso único para pacote normal; prova reforçada apenas para entrega de maior risco, com retenção mínima.
- **Saúde preventiva da frota:** calendário de inspeção/manutenção e custo por veículo depois de existir matrícula/odómetro confiável.
- **Anomalias explicáveis:** alertas em modo de observação para padrões de cancelamento/pagamento/localização; revisão humana antes de qualquer consequência.
- **Contas empresariais e viagens agendadas:** centro de custo, aprovação, reservas com horário e relatório consolidado, depois de financeiro e SLA estarem prontos.
- **Indicador de confiança operacional:** combina entrega pontual, atribuição e cancelamentos por período, com número de amostras e contexto; não é um ranking punitivo.

Estas ideias seguem um princípio: primeiro medir e explicar; depois recomendar; só automatizar uma ação quando houver dados, limites e responsável para reverter. Evitar preço dinâmico opaco, suspensão automática baseada em score e rastreio fora de turno.

## Ordem recomendada

### Prioridade 0 — Fundamentos antes de escalar
01 acesso/cargos; 02 frota/veículos; 03 compliance de motoristas; 04 ledger e ganhos líquidos; 05 meios de pagamento/reconciliação; 07 despacho assistido. Confirmar em paralelo os requisitos fiscais antes de declarar documentos fiscais.

### Prioridade 1 — Operação completa
06 documentos fiscais; 08 cadeia de entrega; 09 suporte/segurança; 10 zonas/turnos; 11 notificações confiáveis; 12 métricas/alertas; 13 configurações persistentes; 19 saúde do sistema.

### Prioridade 2 — Eficiência e crescimento
14 manutenção; 15 previsão de procura; 16 revisão de anomalias; 17 B2B/agendamento; 18 avaliações/qualidade.

Cada iniciativa tem plano independente em docs/backlog/admin-expansion e cópia integral no vault Obsidian. São 20 planos, incluindo um assistente de operações com IA em modo somente consulta e com fontes rastreáveis. O índice principal é 2026-10-17-tot-admin-platform-roadmap.md.

## Fontes e limites

- Evidência local: schema Prisma em backend-monorepo/libs/database/prisma/schema.prisma; rotas em backend-monorepo/apps/admin-api/src/admin-api.controller.ts; análise anterior de telas e contratos em docs/admin-panel-error-audit-2026-10-17.md.
- Benchmark de frota Uber Fleet Hub descreve gestão de veículos/motoristas, viagens e ganhos por veículo/motorista, mapa ao vivo e relatórios: https://www.uber.com/us/en/earn/fleet-management/ e https://help.uber.com/fleet/article/managing-payments-and-earnings-in-the-fleet-hub-portal?nodeId=d88a3e39-be7a-4c2b-b2c1-a9fd91d50bb8
- Exemplo técnico de otimização de frota: Google Route Optimization admite restrições de capacidade, horas de trabalho, janelas de entrega e balanceamento: https://developers.google.com/maps/documentation/route-optimization/overview
- São referências de produto/possibilidade técnica, não requisitos legais nem promessa de integração. A disponibilidade/custo de qualquer fornecedor e as regras fiscais angolanas precisam de validação local antes de implementar.

## Regra de execução para implementação futura

Planos são backlog proposto, não implementação concluída. Executar uma iniciativa por vez com migration aditiva, compatibilidade e rollback, testes definidos no próprio plano, update do vault ao fechar cada fase e revisão de impacto nos apps. Trabalhar direto no projeto. Não gerar APK local nem fazer deploy: APK de teste é produzido no GitHub e deploy fica para etapa futura conforme preferência registada do utilizador.


