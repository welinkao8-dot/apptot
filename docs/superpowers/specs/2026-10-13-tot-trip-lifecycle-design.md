# TOT — experiência completa de corrida, entrega e pagamento

**Data:** 2026-10-13  
**Base:** checkout local `main`, incluindo `2da3ac8`  
**Autorização:** o utilizador pediu plano completo e autorizou avançar para implementação. Execução no checkout atual, sem worktree.  
**Limites:** APIs, app móvel do cliente, app móvel do motorista e alterações estritamente necessárias no painel de gestão. Sites e portais web do cliente/motorista, deploy, publicação e geração local de APK ficam fora.

## Objetivo

Fazer com que cada corrida/entrega percorra um ciclo previsível, recuperável e auditável: localização e destino corretos, rota/cotação coerentes, oferta a motoristas realmente elegíveis, aceitação exclusiva, recolha e percurso, tarifa acordada, conclusão, confirmação de pagamento e recuperação após falhas de rede ou encerramento das apps.

## Opções consideradas e decisão

1. **Remendos locais:** corrigir apenas polyline, textos falsos e alguns listeners. Mais rápido, mas deixa falhas de pedido, concorrência e reconexão espalhadas. Rejeitado.
2. **Reescrever toda a plataforma de viagens:** substituir stack e fluxo. Maior custo e risco; não necessário para corrigir o sistema existente. Rejeitado.
3. **Hardening incremental do fluxo existente (escolhido):** manter NestJS, Prisma/PostgreSQL, Socket.IO, HERE e React Native; definir um contrato único no backend, testar cada estado/falha e ligar as telas ao estado persistido. Custa mais que os remendos e preserva as APIs/app já existentes.

## Regras de produto assumidas

- O cliente escolhe categoria/serviço, confirma origem e destino e vê a estimativa antes de pedir. A origem nunca pode ser substituída silenciosamente por coordenadas padrão.
- O modo de roteamento HERE vem do tipo de veículo configurado. Carros usam rota de carro; motos usam o modo HERE para scooter/motociclo quando o serviço assim estiver configurado. A linha exibida no mapa e as métricas da cotação vêm da mesma resposta do servidor.
- **Preço V1 é fixado na cotação aceite.** A tarifa final é exatamente o valor apresentado e aceite pelo cliente; mudanças de percurso, trânsito ou duração real não aumentam o preço sem novo consentimento. Distância/tempo de rota são estimativas. O mapa externo não fornece automaticamente dados ao TOT.
- O GPS próprio do motorista serve para disponibilidade, localização partilhada e telemetria. Só posições válidas de uma viagem atribuída podem ser publicadas ao cliente. GPS não altera o preço V1.
- Um pedido só é anunciado depois de persistir. A atribuição é exclusiva no banco. Erros, timeout, cancelamento e ausência de motoristas são estados explícitos, nunca uma animação indefinida.
- Numerário continua sendo o único método disponível. A conclusão cria pagamento pendente; o motorista atribuído confirma o mesmo valor persistido. Fatura/recibo não significa pagamento recebido.
- Apps recuperam estado do servidor após reconectar/reabrir. Cache local não vence o banco.
- Socket.IO suporta atualizações em tempo real; APIs REST suportam reconciliação e leitura de estado. Push em app fechada requer FCM/APNs configurado; não se declara entregue sem essa configuração.

## Fluxo de referência

1. App cliente obtém localização com permissão, precisão e idade visíveis; cliente confirma ou escolhe ponto de recolha; pesquisa HERE fornece destino geocodificado; mapa apresenta ambos e a geometria da rota.
2. API valida categoria, serviço, coordenadas e dados de entrega; calcula rota por veículo, tarifa/minimum e ETA; guarda cotação imutável, cliente dono, validade e snapshot de preços. App apresenta preço estimado/fixo e métricas coerentes por opção.
3. Cliente pede corrida com uma chave idempotente/quote; servidor consome cotação e cria a viagem numa transação. Resposta ACK contém ID/estado persistido. Se ACK se perder, a mesma operação não duplica a corrida e o cliente consulta REST para reconciliar.
4. Dispatcher escolhe motoristas ativos, online, conectados e com posição recente; envia ofertas direcionadas em lotes ordenados por proximidade. Oferta expira; aceitação condicional atribui uma única vez; recusa, timeout, trip_taken e expansão/ausência de candidatos são estados persistidos e comunicados. Pedido pendente volta a estar disponível ao motorista apenas se a oferta ainda lhe pertence e não expirou.
5. Motorista recebe pedido com origem, destino, distância/ETA estimados e valor reais; abre mapa externo para recolha, confirma chegada/início manualmente, abre mapa externo para destino e conclui. Serviço nativo de localização mantém posições enquanto permitido; o backend valida ator/estado/qualidade, partilha só com o cliente daquela viagem e regista métricas observadas separadamente da tarifa.
6. Conclusão transacional guarda estado, tarifa acordada, invoice/recibo e pagamento pending. Motorista confirma cash com idempotência; backend confirma valor/atribuição, grava ator/data e emite evento após commit. Cliente e motorista consultam estado persistido se o ACK/evento se perder.
7. Cancelamento, indisponibilidade, GPS perdido, quote expirada, rejeição, desconexão, timeout, processo morto, dupla aceitação, evento duplicado e retry são fluxos testados e com mensagem/recuperação definida.

## Arquitetura e responsabilidades

- `client-api/quotes`: validação, routing provider, preço por modo de transporte, criação/expiração/consumo de cotação.
- `driver-api/trips`: estados e transições condicionais, ownership, preço final congelado, pagamento e recuperação REST.
- `driver-api/rides`: autenticação de socket, dispatcher/ofertas, acknowledgements, eventos pós-commit e reconciliação.
- Mobile cliente: localização confirmada, mapa, seleção de serviço, request ACK, sincronização REST/socket, erros e recibo/pagamento.
- Mobile motorista: disponibilidade, lista/offer direcionada, aceitação, destino externo, estado de percurso, localização em foreground, conclusão e confirmação cash.
- Painel admin: apenas leituras operacionais necessárias para localização, estado da viagem e conciliação; não reintroduzir controles não persistidos.
- Persistência: PostgreSQL/Prisma como fonte da verdade. Redis/Socket.IO adapter, se necessário por topologia, exige decisão/configuração própria e não será presumido.

## Concorrência, rede e recuperação

- Cada comando mutável retorna ACK `{success, ...}` ou erro de domínio legível; o cliente não reporta sucesso antes do ACK/persistência.
- Pedido com cotação é idempotente por `quoteId` + proprietário; retry devolve a viagem já criada em vez de consumir duas vezes.
- Aceitação, início, conclusão, cancelamento e pagamento usam condições de estado/ator na mesma escrita/transaction; apenas um vencedor confirma.
- Eventos saem depois do commit. Reconnect chama join e REST de estado ativo/pending, com IDs e status para ignorar duplicatas e eventos antigos.
- Falha de roteamento impede cotação; falha de GPS impede origem “atual” não confirmada; falta de motoristas termina em estado visível e permite tentar novamente.
- Pagamento pending permanece recuperável se cliente/motorista fechar a app ou perder socket; timeout de ACK faz GET do estado do pagamento antes de repetir.

## Segurança e privacidade

- JWT determina client/driver; IDs do socket/payload não definem identidade. Ownership e estado são validados por ação.
- Oferta e coordenadas do cliente são visíveis apenas a motoristas elegíveis; localização precisa não é broadcast global. Cliente vê localização apenas do motorista atribuído.
- Validate latitude/longitude, accuracy, timestamp, frequência, saltos/velocidade e autorização da viagem antes de atualizar/publicar localização.
- HERE routing key fica no servidor. Chave mobile de mapas/geocoding, se mantida por requisito SDK, deve ser restrita a package/bundle e APIs; nunca tratada como segredo.
- Payloads, erros e logs não contêm documentos, tokens ou detalhes pessoais desnecessários.

## Fora de escopo e limites externos

- Não implementar turn-by-turn próprio: o botão abre Google Maps/Apple Maps ou app disponível, para coordenadas corretas.
- Não tornar a navegação externa fonte de distância/tarifa; V1 permanece preço fixo aceite.
- Não habilitar cartão/Multicaixa sem provider/conta/webhooks e testes de liquidação.
- Push em app encerrada necessita projetos/credenciais FCM/APNs. Código pode ser preparado, mas delivery real depende de configuração e build GitHub.
- Não fazer deploy, migração em produção, alteração Coolify, push ao Git remoto ou publicação de APK.
- Não implementar sites nem portais web cliente/motorista.

## Critérios de aceitação

1. Com GPS válido, origem confirmada, autocomplete e toque no mapa produzem coordenadas/adereços coerentes; sem GPS válido não há pedido silencioso com fallback.
2. Cada serviço mostra preço, distância, ETA e geometria da mesma rota calculada para o veículo correto; quote expira e é consumida uma vez.
3. Pedido/retry/ACK/erro/sem motorista não duplicam nem deixam cliente em busca infinita.
4. Só motoristas elegíveis recebem oferta; ofertas recuperam após reconnect e uma corrida tem no máximo um motorista vencedor.
5. Motorista navega externamente para recolha e destino; o TOT continua a reportar localização validada quando Android permite; pedido não mostra métricas inventadas.
6. Tarifa final é exatamente a cotação aceite; conclusão e pagamento ficam em estados distintos; cash só vira confirmado por ação autorizada e idempotente.
7. Cada mudança crítica e cada interrupção tem testes unitários, socket/e2e e mobile; as telas mostram estado persistido após reabrir.
8. A matriz de QA manual documenta foreground/background, permissões, perda de rede, dois motoristas aceitando, quote expirada, cancelamento e pagamento; resultados de dispositivo são marcados como não executados até testar no Android real.

