# Camada visual da consola de administração

Uma só camada, importada uma vez em `src/main.jsx` através de `src/styles/index.css`.
Substitui quatro sistemas que coexistiam: `Dashboard.css` (`.dashboard-*`), `AdminSurface.css`
(`.tot-*`), cerca de 30 utilidades tipo Tailwind escritas à mão e 350 estilos inline no JSX.

## Regras (todas verificáveis)

1. **Zero hex, `font-size`, `border-radius` ou sombra fora de `tokens.css`.** Tudo vem de uma variável.
2. **Zero `!important`.**
3. **Zero estilos inline no JSX**, exceto valores que só o runtime conhece (cores de gráfico calculadas, posições de pontos).
4. **Zero utilidades tipo Tailwind.** `flex`, `items-center`, `gap-4`, `ml-4`, `py-40`, `text-slate-400`, `opacity-10` não existem. Use a classe semântica que descreve o papel do elemento.
5. **Toda a classe usada no JSX tem regra definida** nesta camada.
6. **Media queries sempre no fim do ficheiro.** Nenhuma regra base pode vir depois de um bloco responsivo.
7. **Texto com contraste ≥ 4,5:1.** `--tot-faint` só pode ser cor de ícone decorativo, nunca texto.

## A tese

A matéria do painel é o **número** e o **estado**. A cor de marca é o instrumento que os marca,
não a superfície que os contém.

- **Marca** (`--tot-brand`) = rail, marcas, decoração, identificação. Nunca contém texto.
- **Marca com texto** (`--tot-brand-ink`) = qualquer superfície preenchida com texto, e o rótulo do estado ativo. Branco sobre `--tot-brand` mede 4,35:1 e falha AA; por isso quem carrega texto é `--tot-brand-ink` (5,87:1).
- **Estado** (`--tot-waiting`, `--tot-accepted`, `--tot-live`, `--tot-done`, `--tot-cancelled`, `--tot-active`, `--tot-suspended`, `--tot-pending`) = o único lugar onde a cor significa algo. A marca nunca aparece aqui.
- **Neutros** = toda a estrutura. Era o que faltava: havia seis pretos e quatro cinzentos de fundo a competir.

## Vocabulário

| Papel | Classe |
|---|---|
| Botão | `.tot-btn` + `--primary` `--soft` `--ghost` `--success` `--danger` `--sm` `--lg` `--block` `--icon` |
| Busca | `.tot-search` |
| Select / filtro | `.tot-select`, `.filter-group` |
| Cabeçalho de página | `.page-header` + `.page-title` |
| Cabeçalho de módulo | `.module-header-nav` > `.module-header-left` (título + voltar) e `.header-actions` |
| Voltar | `.btn-back-square` |
| Lista de registos | `.admin-record-list` > `.admin-record-list-head` + `.admin-record-row` |
| Colunas por família | `.clients-record-*`, `.drivers-record-*`, `.trips-record-*` |
| Célula principal | `.card-left-section` > `.avatar-box` + `.info-group` |
| Valores secundários | `.record-primary-value`, `.record-secondary-label` |
| Colunas específicas | `.client-record-activity`, `.client-record-date`, `.driver-account-state`, `.driver-presence-label`, `.trip-record-state`, `.trip-record-fare` |
| Ações de linha | `.record-actions` > `.record-action` (ligação) e `.record-action-icon` (ícone) — aparecem no hover/foco e ficam sempre visíveis abaixo de 900px |
| Estado | `.status-pill .status-pill--{waiting\|accepted\|live\|done\|cancelled\|active\|suspended\|pending\|neutral}` |
| Presença | `.status-indicator-dot` + `.is-online` / `.is-offline` |
| Traça de percurso | `.trip-route` > `.trip-route-stop` > `.trip-route-label` + `.trip-route-value` |
| Indicador | `.tot-indicator` > `.tot-indicator-label` + `.tot-indicator-value` |
| Faixa "agora" | `.tot-now` > `.tot-now-lead`, `.tot-now-item`, `.tot-now-alert` |
| Cartão | `.tot-dashboard-card` (painel), `.pricing-group-card` (tarifas) |
| Vazio | `.empty-state-container` ou `.tot-empty` |
| Modal | `.modal-overlay` > `.modal-content` (`> .modal-header`, `.modal-footer`) |
| Formulário | `.service-form`, `.form-section`, `.form-sections-grid`, `.input-group`, `.input-row`, `.input-field` / `.input-field-premium` |
| Recibo | `.receipt-modal`, `.receipt-row`, `.receipt-divider`, `.receipt-total` |

## Assinatura

A **traça de percurso** (`.trip-route`) é o único elemento com personalidade própria: uma linha com
dois nós, origem em `--tot-brand` e destino em `--tot-ink-2`. Existia esquecida a 0.68rem em caixa
alta; agora é o que identifica a consola. Não a duplique com outro enfeite.

## Números que mudaram

| Antes | Agora |
|---|---|
| 177 cores hex distintas | 0 fora de `tokens.css` |
| 72 tamanhos de letra | 11 passos, piso de 12px |
| >20 raios | 4 (4 / 8 / 16 / 9999) |
| 43 `!important` | 0 |
| 350 estilos inline | 0 |
| 94 seletores sem uso | 0 |
| Contraste mínimo 2,29:1 | ≥ 4,5:1 |
| 5 classes sem regra | 0 |
