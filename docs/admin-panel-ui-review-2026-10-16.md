# Revisão e melhorias de UI/UX do painel administrativo — 16/10/2026

## Escopo

Revisão do frontend em `admin-portal/frontend`. A intervenção limita-se à apresentação, legibilidade, responsividade e interação visual; não altera contratos de API nem regras de negócio. As imagens enviadas pelo utilizador foram usadas como evidência dos problemas nas listas de clientes e motoristas.

## Problemas observados

### Estrutura geral e navegação

- A barra lateral era fixa, mas a navegação não tinha uma área de rolagem própria; opções inferiores podiam ficar fora do ecrã.
- O menu ocupava 280 px, tinha preenchimento excessivo, botões altos e sombras/transições fortes para um painel operacional.
- O conteúdo principal tinha cartões grandes e espaçamento excessivo, reduzindo a quantidade de registos visíveis.
- O JSX usa várias classes de utilidade como `gap-4`, `ml-4`, `truncate` e tamanhos arbitrários, mas o projeto não instala Tailwind. Parte desses estilos não existia no CSS, causando elementos encostados e texto sem truncagem.

### Visão geral

- Indicadores usavam gradientes e sombras dominantes, sem hierarquia suficientemente clara entre rótulo e valor.
- O título “Paineis de Controle” tinha erro de acentuação e linguagem genérica.
- Gráficos tinham pouco alinhamento visual com o resto do painel.

### Motoristas e clientes

- Cada resultado era apresentado como um cartão alto com fundo rosa e borda própria; os registos competiam entre si e poucos cabiam na viewport.
- Nome, telefone, ações, estado e metadados partilhavam uma linha sem separação consistente.
- No registo de clientes, “0 CORRIDAS PAGASMembro desde…” aparecia sem espaçamento; a origem foi a falta de estilos para classes utilitárias do JSX.
- No registo de motoristas, estado em inglês e um ponto colorido sem texto não comunicavam claramente aprovação e presença online/offline.
- Perfis de clientes e motoristas usavam colunas fixas que não se adaptavam bem a ecrãs estreitos.

### Tarifas, corridas, faturas e pagamentos

- Cartões de tarifas tinham demasiadas camadas, bordas rosa, elevação e espaçamento; valores podiam perder leitura em cartões estreitos.
- O formulário de tarifas abria num modal largo sem limite de altura/scroll interno; em portáteis pequenos os campos e ações podiam ficar fora da janela.
- O modal de detalhe de corrida era estreito e não tinha scroll interno para endereços e conteúdo longo.
- A lista de faturas usava colunas CSS que podiam ser cortadas em ecrãs menores; o modal de fatura também não limitava altura nem rolava.
- Pagamentos tinham tabela larga; a rolagem horizontal não estava suficientemente explícita e a hierarquia dos cabeçalhos era fraca.

### Operação em tempo real

- O layout usava altura de viewport rígida e uma coluna lateral estreita; em ecrãs baixos ou móveis o mapa e os painéis podiam ficar comprimidos.
- Listas de motoristas/corridas tinham demasiados detalhes em pouco espaço e localização longa sem truncagem consistente.

### Auditoria, configurações e login

- Registo de auditoria e configuração misturavam estilos inline, tamanhos de texto muito pequenos e agrupamento variável.
- O login usava um selo azul sobre fundo rosa, texto secundário com contraste insuficiente e rótulos sem associação explícita aos campos.
- Vários cabeçalhos e botões estavam em maiúsculas, ou usavam termos em inglês onde havia alternativa clara em português.

### Modais e diálogos encontrados

- Editar/criar tarifa (`Pricing.jsx`): modal de 950 px sem uma área de formulário rolável e ações previsíveis.
- Localização do motorista (`Drivers.jsx`): overlay e janela definidos em estilos inline, sem altura máxima/rolagem em viewport baixa.
- Detalhe de corrida e recibo (`Trips.jsx`, `Clients.jsx`): corpo não rolável e endereços longos podiam ultrapassar o cartão.
- Detalhe de fatura (`Invoices.jsx`): modal inline de largura fixa sem semântica de diálogo nem contenção de altura.
- Motivo de alteração de estado (`StatusReasonDialog.jsx`): tamanho confortável, mas sem tratamento visual partilhado nem limite de altura.

## Alterações realizadas

- Criada a folha comum `admin-portal/frontend/src/pages/AdminSurface.css` com tokens da interface, estilos de foco, navegação, listas, cartões, tabelas, estados e breakpoints.
- Sidebar agora tem área de navegação com rolagem independente, scrollbar própria e rodapé de sessão separado; dimensões e itens foram compactados.
- Listas de clientes, motoristas e corridas passaram a usar linhas de dados compactas, separadores neutros, ações agrupadas e estados visíveis, mantendo os mesmos fluxos.
- Corrigidos os estilos utilitários que o JSX usava sem Tailwind, incluindo alinhamento, gaps, truncagem, margens e texto.
- Metadados de cliente têm ícones, espaçamento, plurais e data `pt-AO`; presença de motorista mostra “Online”/“Offline”, e estados de conta são localizados.
- Indicadores, cartões de tarifas, tabelas e perfis usam hierarquia mais sóbria, superfícies consistentes e melhor adaptação responsiva.
- Modais e diálogos têm altura máxima baseada na viewport, scroll vertical, scroll próprio para conteúdo extenso, padding móvel e rótulos de acessibilidade em detalhes de corrida/localização/fatura.
- Operação live adapta mapa e listas para ecrãs estreitos e limita a altura da lista lateral.
- Login recebeu ajustes de contraste, texto e associação dos labels aos campos.
- Corrigidos o título do painel e o rótulo “Registo de auditoria”.

## Verificação e limitações

- `npm run build` em `admin-portal/frontend`: passou com sucesso.
- Vite assinala bundle JavaScript principal acima de 500 kB; não foi alterado nesta tarefa.
- O detector estático `anti-ui-slop` foi executado uma vez: sinalizou uso de fonte comum `Inter`; a folha foi ajustada para conservar `Outfit`, já carregada pelo painel.
- Não foram executados testes automatizados, APK, API, deploy ou teste em dispositivo.
- A primeira revisão foi superficial: as listas ainda pareciam cartões genéricos, sem identidade própria. O feedback do utilizador identificou corretamente que raio e sombra não resolviam a falta de linguagem visual.

## Revisão estrutural após feedback (16/10/2026)

- Clientes, motoristas e corridas foram convertidos em grades de dados com cabeçalho de colunas, hierarquia por tipo de informação e separadores contínuos. Os registos deixam de competir como cartões individuais.
- Clientes mostram atividade, data e ações em colunas; motoristas separam conta, disponibilidade e ações; corridas agrupam origem/destino numa leitura de percurso e alinham estado, tarifa e detalhe.
- A visão geral usa uma grelha de seis indicadores em duas filas de três, com divisores e uma linha de acento TOT. Em ecrãs menores, adapta para duas colunas e depois uma coluna, em vez de deixar um indicador isolado.
- O filtro de estado das corridas usa o Rubber Segment do [React Bits](https://reactbits.dev/micro/rubber-segment), integrado como código-fonte local, controlado pelo estado React e com `aria-label`. A licença e a origem estão anotadas no componente.
- A inspeção no browser confirmou a separação de colunas e o alinhamento de estado/tarifa/ação nas três listas. O layout de modais, tarifas e restante dashboard ainda precisa de validação visual tela a tela; esta atualização não declara todo o painel finalizado.
- O pacote `motion` foi adicionado como dependência direta para o componente React Bits.

## Ficheiros principais

- `admin-portal/frontend/src/pages/AdminSurface.css`
- `admin-portal/frontend/src/pages/Dashboard.jsx`
- `admin-portal/frontend/src/pages/Clients.jsx`
- `admin-portal/frontend/src/pages/Drivers.jsx`
- `admin-portal/frontend/src/pages/Trips.jsx`
- `admin-portal/frontend/src/pages/Invoices.jsx`
- `admin-portal/frontend/src/pages/LiveOps.jsx`
- `admin-portal/frontend/src/pages/Login.jsx` e `Login.css`
- `admin-portal/frontend/src/components/StatusReasonDialog.jsx`

## Ajuste do dashboard pela referência visual (16/10/2026)

O ajuste anterior aplicou demasiada linguagem própria e não reproduzia a organização visual de referência. Esta passada corrigiu a composição em vez de acrescentar mais efeitos decorativos.

- **Estrutura:** painel lateral alto com marca, grupos de navegação e estado de presença; barra superior discreta; título e contexto da operação abaixo da barra.
- **Indicadores:** seis cartões compactos numa grelha de três colunas. Cada cartão tem faixa fina de cor, rótulo em caixa alta, valor dominante e ponto de estado. Receita apresenta `Kz` como etiqueta pequena, sem um ícone grande a competir com o número.
- **Análise:** cartões arredondados para tendência de receita e distribuição por categoria. Os gráficos recebem apenas dados reais de `/admin/analytics`; os estados vazios são explícitos.
- **Operação:** adicionei a tabela de últimas corridas com dados reais de `/admin/trips`, e o painel de ações com os dados reais de `/admin/logs`. A ação de aprovar motorista aparece apenas quando a API devolve motoristas pendentes.
- **Dados:** nenhuma métrica, viagem, placa, valor, gráfico ou alerta foi copiado da referência. O modelo visual foi adaptado aos dados que o painel já obtém.

### Verificação

- `npm run build` em `admin-portal/frontend` passou depois do ajuste.
- A aplicação aberta localmente confirmou a renderização dos seis indicadores, cinco corridas recentes e quatro eventos de auditoria reais.
- O warning do Vite sobre bundle principal acima de 500 kB continua apenas como backlog de desempenho; não foi introduzido por esta alteração.
