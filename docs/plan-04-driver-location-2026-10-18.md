# Plano 04 — localização de motorista no painel (2026-10-18)

## Alteração

`Drivers.jsx` já consultava o endpoint por motorista e mostrava posição válida/stale ou indisponível. Identifiquei uma corrida entre pedidos: respostas lentas podiam trocar a posição do perfil que o operador acabara de abrir. A consulta agora usa sequência latest-wins; fechar o modal invalida o pedido e termina o loading. Coordenadas inválidas continuam sem pin.

## Verificação

- Teste com promises adiadas confirma que a resposta mais recente permanece e a resposta anterior retorna estado stale.
- Teste renderizado com React/Vite confirma os estados indisponível, stale e atual, incluindo idade, precisão e presença/ausência do mapa.
- `npm test` no admin frontend: 74 testes aprovados.
- `npm run build` no admin frontend passou. Vite emitiu o aviso existente de chunk principal acima de 500 kB.
- A validação manual no browser permanece pendente. Nesta fatia não houve alteração de desenho.

## Biblioteca de testes UI — 18/10/2026

- Adicionadas `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event` e `jsdom` como dependências de desenvolvimento; sem alterar dependências de produção.
- O teste de localização agora monta o componente no DOM e usa interação de utilizador para clicar em “Tentar novamente”, além de verificar ausência, stale, posição atual e mapa.
- Criado `admin-portal/frontend/src/test/setupReactTesting.js` reutilizável e `admin-portal/frontend/TESTING.md` com instruções e limites do jsdom.
- `npm test`: 74/74; `npm run build`: passou. `npm audit --omit=dev` reportou 10 vulnerabilidades (5 moderadas, 5 altas) nas dependências de produção já existentes; não foram aplicadas atualizações gerais neste trabalho.

Sem alteração de design.
