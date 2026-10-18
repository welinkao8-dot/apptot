> **Nota de estado — 18/10/2026:** este levantamento reflecte o escopo antes da clarificação do proprietário. O app emitirá apenas um recibo operacional não fiscal, disponível para guardar, partilhar ou imprimir. O Plano 06 está concluído nesse escopo; o relatório autoritativo é [plan-06-operational-receipt-2026-10-18.md](plan-06-operational-receipt-2026-10-18.md). A análise fiscal abaixo fica apenas como referência futura caso o produto venha a emitir documentos fiscais.
# Plano 06 — prontidão fiscal e inventário de recibos — 18/10/2026

## Estado

**Não concluído; implementação fiscal bloqueada pela validação do contribuinte e do sistema junto de contabilista/AGT.** Foi concluído o inventário do comportamento existente e a pesquisa legislativa inicial. Não houve alterações de código, migrations, dados ou deploy.

## Inventário confirmado no checkout

- `backend-monorepo/libs/database/prisma/schema.prisma:77` define `invoices` com `id`, `trip_id`, `user_id`, `pdf_url` opcional, `amount`, `invoice_type` e `created_at`. Não há série/número fiscal, emissor/NIF, linhas, imposto, moeda, estado fiscal, referência de validação nem histórico de rectificação/cancelamento.
- `backend-monorepo/apps/driver-api/src/trips/trips.service.ts:448` conclui a viagem, usa a tarifa persistida, cria um registo `ride_receipt`/`delivery_receipt` se ainda não existir e cria o pagamento cash como `pending`. Portanto, recibo criado não equivale a pagamento confirmado.
- `backend-monorepo/apps/admin-api/src/admin-api.service.ts:190` lista e agrega os registos. `admin-portal/frontend/src/pages/Invoices.jsx:279` oferece o link PDF somente quando `pdf_url` tem valor; não foi encontrado fluxo backend que gere esse PDF ou verifique se o objecto existe.
- O ecrã chama a secção “Faturas” apesar de os tipos actuais serem recibos operacionais. Isso pode induzir o operador a confundir comprovativo com documento fiscal. Nenhuma alteração de interface foi feita nesta fase.

## Pesquisa normativa inicial

- O Decreto Presidencial n.º 71/25 estabelece o regime de facturas e documentos fiscalmente relevantes; o texto consultado define facturas e recibos como categorias distintas, sujeita a facturação electrónica aos regimes indicados e prevê fases de implementação.
- O Decreto Executivo n.º 683/25, publicado no Diário da República de 22/08/2025 e disponibilizado no domínio do Ministério das Finanças, estabelece a estrutura/modelo técnico e atribui à AGT a geração das séries usadas nas facturas electrónicas. Assim, a sequência fiscal não deve ser criada pelo TOT por suposição.
- A AGT também publicou orientação relativa à obrigação de SAF-T de contabilidade para o exercício de 2026, com entrega em 2027. A aplicabilidade operacional ao Grupo Torres Center precisa ser confirmada pelo contabilista.

Fontes consultadas:
- Decreto Presidencial 71/25 (texto do Diário da República reproduzido): https://lex.ao/docs/presidente-da-republica/2025/decreto-presidencial-n-o-71-25-de-20-de-marco/
- Decreto Executivo 683/25 (PDF no domínio do Ministério das Finanças): https://www.ucm.minfin.gov.ao/cs/groups/public/documents/document/aw40/otuy/~edisp/minfin4952361.pdf
- Orientação AGT sobre SAF-T contabilístico 2026: https://portaldocontribuinte.minfin.gov.ao/noticia?id=985578
- Portal AGT (lista o Regime Jurídico das Facturas): https://www.agt.minfin.gov.ao/PortalAGT/

Esta leitura documental não constitui parecer fiscal nem confirma se houve alterações normativas posteriores ou qual fase se aplica ao TOT.

## Fases do Plano 06

1. **Parcial — bloqueio externo:** identificadas as normas-base; falta contabilista/AGT confirmar regime fiscal do Grupo, se é fornecedor do Estado/grande contribuinte, fase e data de obrigatoriedade, emissor legal em viagens intermediadas, software validado, série AGT e integração/API disponível.
2. **Concluída como inventário:** mapeado o modelo e a emissão actuais acima. Nenhum histórico será reinterpretado ou migrado sem decisão aprovada.
3. **Bloqueada pela fase 1:** não implementar emissão fiscal, gatilhos, séries ou impostos sem contrato validado.
4. **Bloqueada pela fase 1:** não gerar/assinalar PDF fiscal nem criar numeração fiscal local. PDF operacional futuro precisa de armazenamento privado e validação do ficheiro.
5. **Pendente:** consulta/download autorizado, envio e exportação precisam de definir permissões, retenção e classificação documental.
6. **Pendente:** cenários de correcção, cancelamento, reembolso, pagamento parcial e auditoria dependem dos tipos e regras definidos por contabilista/AGT.

## Dados necessários para retomar

Pedir ao contabilista/AGT uma resposta escrita sobre:

1. Entidade que presta legalmente o serviço ao passageiro e entidade emissora do documento (TOT, parceiro/operador, motorista, ou outro arranjo contratual).
2. Regime fiscal/IVA do Grupo Torres Center e enquadramento como grande contribuinte/fornecedor do Estado; fase aplicável e data de entrada obrigatória.
3. Se o sistema TOT pode ser o software de facturação validado ou se deve integrar com software certificado; fornecedor e API/SAF-T/especificação aplicável.
4. Quem obtém a série fiscal da AGT, numeração e código digital/QR; regras para rectificação/anulação e documentos por pagar/recibos.
5. Dados do emissor, impostos, linhas, moeda, retenção, conservação, documentos de correcção e exportação exigidos para cada cenário ride/delivery.

Com essa resposta, actualizar o desenho e retomar pelo modelo de dados/serviço, primeiro com testes locais e sem activar emissão de produção.
