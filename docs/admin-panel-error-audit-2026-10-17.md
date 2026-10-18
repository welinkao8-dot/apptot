# Auditoria de erros do painel administrativo — 17/10/2026

## Escopo

Foi feita uma revisão do painel administrativo inteiro, não só da edição de serviços: autenticação/layout, dashboard, operação ao vivo, motoristas, clientes, tarifas/serviços, corridas, faturas, pagamentos, auditoria, configurações e os modais/estados de erro ligados a essas telas. A revisão usou código de frontend e Admin API, contratos, testes e verificações locais. Não houve inspeção visual autenticada de cada modal nesta sessão.

## Correções aplicadas

### Edição de serviços

- A primeira correção foi incompleta: normalizava o objeto, mas ainda enviava metadados retornados pela API. O erro observado no portal confirmou que `id` e `updated_at` chegavam ao DTO e eram rejeitados pela validação global estrita.
- O formulário agora cria o corpo da requisição a partir de uma lista permitida de campos editáveis. `id`, `created_at`, `updated_at` e metadados adicionais não podem seguir no POST de atualização.
- A linha antiga `Moto Táxi` vinha da base com `platform_fee_type = percent`, enquanto o contrato atual só aceita `percentage` ou `fixed`.
- A normalização do formulário agora converte `percent`, `percentage`, `fixed_amount` e `amount` para o vocabulário canónico antes de enviar.
- O DTO da Admin API também normaliza `PERCENT`/`percent` com espaços, protegendo clientes antigos que chamem a API diretamente.
- Foi aplicada a migration `20261017110000_normalize_service_fee_types` na base local. Ela corrige os valores legados e adiciona uma constraint para impedir novos valores fora de `percentage` e `fixed`.

### Dashboard

- Removido o número de cartão inventado `•••• 909090`.
- Removida a variação inventada `+12.8%`; a interface informa quando ainda não há histórico suficiente para calcular a variação.
- Removida a série de corridas artificial que gerava números quando a API não tinha dados. O gráfico agora mostra estado vazio factual.
- Removido o seletor `Mensal`, que não tinha endpoint nem dados mensais ligados; o painel informa `Últimos 7 dias`.
- Corrigido o mapeamento de corridas recentes: a API entrega `category`, `final_fare`, `estimated_fare` e `profiles_trips_client_idToprofiles.full_name`, e o dashboard passou a usar esses campos.
- Corrigido o nome do administrador para preferir `full_name`.
- Corrigidas as iniciais dos motoristas pendentes para usar `full_name`.
- O primeiro carregamento deixou de aparecer como zeros ou listas vazias: o dashboard mostra `A carregar...` até a API responder.
- O cartão com aparência de carteira passou a ser identificado como operação TOT, sem sugerir um cartão ou saldo de carteira que não existe na API.
- A página Configurações passou a usar os formatadores partilhados para categoria, veículo e valores em Kz, evitando enums crus e `NaN` quando um campo opcional vier vazio.

### Operação ao vivo, dados e resiliência nas telas

- **Operação Live:** antes pedia as 20 corridas mais recentes e filtrava as ativas no browser. Uma corrida ativa fora dessas 20 desaparecia do painel. Agora a consulta pede o estado `live` à Admin API (até 100 itens por página) e o contador usa o `total` do servidor; o normalizador aceita paginação apenas para corridas, mantendo a validação da lista de motoristas.
- **Dashboard / analytics:** o gráfico da API tinha apenas receita por dia, embora a interface também esperasse volume de corridas. A API agora devolve receita confirmada e quantidade de corridas criadas por dia. Os sete pontos usam dias de calendário de Angola (`Africa/Luanda`) e incluem sete dias completos, evitando o primeiro dia parcialmente cortado pela janela móvel de sete dias.
- **Configurações:** uma resposta malformada já não é convertida silenciosamente numa lista vazia. Erros mantêm os últimos dados bons e mostram aviso com opção de repetir.
- **Motoristas:** o filtro agora inclui `Suspensos`, que a API já suportava, mas a interface não oferecia.
- **Auditoria:** limites de texto dos filtros acompanham os limites aceites pela API (ação/alvo 255, pesquisa 120); uma ação malformada não derruba o rótulo da linha.
- **Pagamentos e faturas:** linha de pagamento não quebra se a relação da corrida estiver ausente; datas inválidas mostram marcador legível em vez de `Invalid Date`.
- **Contratos de listas financeiras e corridas:** respostas com montantes nulos/malformados, estado inválido ou corrida sem ID/estado agora são rejeitadas como erro; deixam de aparecer como `Kz 0` ou provocar crash durante o render.
- **Clientes e motoristas:** valores finais iguais a zero deixam de ser substituídos pela estimativa; datas e dinheiro usam formatadores partilhados em pt-AO/Kz, inclusive os ganhos do motorista.
- **Estados de API:** a leitura da tela de pagamentos preserva a última página boa em falha; configurações agora também explicitam falha ao invés de afirmar que não há dados.

### Cobertura da revisão do painel

- **Login e sessão:** proteção de rotas, sessão persistida, tratamento 401 e socket de autenticação cobertos por testes de serviço.
- **Dashboard:** contratos de stats, analytics, corridas recentes e ações rápidas revisados; retirados números fictícios e melhorada a indicação de erro/carregamento.
- **Operação Live:** posições com coordenadas e timestamps validados; falha de cada recurso preserva o último snapshot correto; consulta de corridas ativas agora server-side.
- **Motoristas/clientes:** paginação, filtros, pesquisa, histórico, status, documentos e detalhes revisados; ações que alteram estado exigem motivo e preservam erro até sucesso.
- **Tarifas:** criação/edição, campos permitidos, tipos de comissão, compatibilidade de roteamento, upload e exclusão revisados; erro de payload e fee legado corrigidos.
- **Corridas/faturas/pagamentos/auditoria:** paginação, filtros, resumo financeiro, campos efetivamente fornecidos pela API e tratamento de resultados vazios/erro revisados.
- **Configurações:** deixa claro que parâmetros globais não estão persistidos; não simula controles inexistentes; lista de serviços agora diferencia erro de lista vazia.
- **Layout e modais:** rotas e componentes existentes foram revistos no código, mas altura/rolagem, breakpoint e aparência final de cada modal ainda precisam de inspeção manual no browser autenticado.

## Dados persistidos que precisam de limpeza antes da produção

Estes valores foram encontrados na base local e não estão hardcoded no frontend:

- Serviço `hvvzxcvghzx`, criado em 17/10/2026, sem descrição/imagem e sem corridas ou cotações. Parece um registo de teste.
- Utilizadores e motoristas seed/teste, incluindo telefones `999999998`, `999999999`, `900000001` e moradas como `teste`.
- O serviço `Moto Táxi` tem tarifas `200000.00` e 184 corridas associadas. Pode ser uma tarifa real antiga ou um dado de teste; não foi alterado automaticamente para não corromper histórico.

Nenhum registo foi apagado automaticamente. A remoção desses dados deve ser uma decisão explícita porque altera a base persistida e pode afetar histórico, faturação e auditoria.

## Verificação

- Frontend: `npm test` — **71/71** testes aprovados, incluindo payload de serviço, contratos de paginação, estados de erro e formatação.
- Frontend: `npm run build` — concluído com sucesso; permanece apenas o aviso de bundle principal acima de 500 kB.
- Backend: `npm test -- --runInBand` — **40 suites / 387 testes** aprovados, incluindo analytics dos sete dias de Angola.
- Backend: `npm run build` — compilação Nest concluída com sucesso.
- API local: `GET http://127.0.0.1:3000/health` respondeu HTTP 200.
- Frontend local: `http://127.0.0.1:5175` respondeu HTTP 200.

## Limite da validação

Esta auditoria valida código, contratos, testes e compilações. O estado do frontend e da Admin API foi verificado anteriormente como HTTP 200. A inspeção visual interativa de cada ecrã/modal e o teste end-to-end autenticado ainda precisam ser feitos no browser. Não foi feito build de APK nem deploy.
