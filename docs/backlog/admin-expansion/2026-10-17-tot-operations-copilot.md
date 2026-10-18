# Plano 20 — Assistente de operações com IA

## Planning header

- Goal: Ajudar operadores a perceber rapidamente o que aconteceu numa viagem e quais ações seguras podem considerar.
- Architecture: Assistente de consulta com recuperação de dados autorizados e resposta ligada às fontes do sistema; nenhuma escrita ou ação operacional automática.
- Tech Stack: React/Vite admin, NestJS, Prisma/PostgreSQL e um provedor de modelo aprovado pela empresa, se a análise de dados/privacidade permitir.
- Spec path: docs/backlog/admin-expansion/admin-platform-capability-audit-2026-10-17.md; roadmap: docs/backlog/admin-expansion/2026-10-17-tot-admin-platform-roadmap.md.
- Global Constraints: sem worktree, sem build APK local e sem deploy; acesso server-side por RBAC, minimizar PII, não enviar segredo/documento ao modelo, pedir confirmação humana para ação e atualizar Obsidian por fase.
- Task structure: fases numeradas e critérios abaixo são gates independentes; não ativar escrita por agente.

## Objetivo e inovação
Permitir perguntas como “por que esta entrega está atrasada?”, “o que mudou no preço?” ou “quais pagamentos estão pendentes de conferência?”. O assistente resume fatos de eventos, pagamentos, localização recente e regras de tarifa com links internos para a tela/registro. É um copiloto de consulta para reduzir tempo de investigação, não um decisor.

## Arquitetura proposta
Buscar dados estruturados através dos serviços internos já autorizados; fornecer ao modelo apenas o contexto mínimo e sanitizado. Respostas devem incluir fontes e horários, distinguir fato de inferência e dizer “não tenho dados” quando faltar evidência. O modelo não recebe acesso SQL direto, não cria nem altera dados e não pode cruzar escopos de permissões.

## Fases
1. Medir os casos de suporte/operação mais frequentes e confirmar que os dados de eventos são suficientemente estruturados.
2. Criar ferramenta server-side de consulta com DTOs estritos, allowlist de campos, RBAC por recurso e mascaramento de telefone/identificadores.
3. Prototipar modo shadow para perguntas de viagem, despacho e reconciliação; comparar resposta com a linha temporal e os valores reais.
4. Criar painel de conversa que mostre fontes clicáveis, timestamp, confiança e botão para abrir a tela original.
5. Implementar avaliação offline de respostas erradas, dados incompletos, instrução maliciosa em texto de suporte, conflito de papel e ausência de integração.
6. Lançar para um grupo interno limitado, medir correção/tempo poupado/custo e manter alternativa de busca manual.
7. Só estudar comandos operacionais numa proposta separada, com confirmação humana explícita e audit trail.

## Critérios de aceitação
- Cada afirmação factual importante traz referência a registo e timestamp; inferência vem identificada.
- Sem evidência, o assistente não inventa estado, ETA, preço ou confirmação de pagamento.
- O utilizador só consulta informação que o seu papel pode abrir diretamente no painel.
- O modelo não executa SQL, não altera estado e não envia comunicação ao cliente/motorista.
- Logs de avaliação não guardam conversa/PII além do necessário e têm política de retenção.
- O recurso pode ser desligado sem afetar corrida, pagamento, push ou despacho.

## Dependências, riscos e validação
Depende de RBAC, eventos estruturados, ledger, despacho, tickets e política de dados. A primeira fase pode ser apenas pesquisa e resumo por regras, sem modelo externo. Antes de qualquer provedor, validar tratamento/retensão de dados, custo, localização e contrato. Respostas devem ser verificadas por operadores durante o piloto.

