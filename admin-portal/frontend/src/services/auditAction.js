/* Descreve acções de auditoria em português.

   Antes, o painel mostrava o valor cru da base de dados como se fosse o nome
   da ação — "UPDATE STATUS ACTIVE", repetido três vezes no feed de atividade
   recente, em caixa alta e em inglês. Aqui a ação ganha uma frase em português
   e um tom, para que a cor da lista venha do significado e não do enum.
*/

export const AUDIT_TONES = ['positive', 'negative', 'info', 'neutral']

const EXACT_ACTIONS = {
    'update status active': { label: 'Conta de motorista ativada', tone: 'positive' },
    'update status suspended': { label: 'Conta de motorista suspensa', tone: 'negative' },
    'update status rejected': { label: 'Registo de motorista rejeitado', tone: 'negative' },
    'update status pending': { label: 'Registo de motorista em análise', tone: 'info' },
    'update status': { label: 'Estado do motorista atualizado', tone: 'info' },
    'driver approved': { label: 'Motorista aprovado', tone: 'positive' },
    'driver created': { label: 'Motorista registado', tone: 'info' },
    'driver deleted': { label: 'Motorista removido', tone: 'negative' },
    'pricing updated': { label: 'Tarifas atualizadas', tone: 'info' },
    'pricing created': { label: 'Serviço de tarifa criado', tone: 'info' },
    'pricing deleted': { label: 'Serviço de tarifa removido', tone: 'negative' },
    'login': { label: 'Sessão iniciada', tone: 'neutral' },
    'logout': { label: 'Sessão terminada', tone: 'neutral' },
}

const normalize = action => String(action || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

export function describeAuditAction(action) {
    const key = normalize(action)
    if (!key) return { label: 'Registo de auditoria', tone: 'neutral' }
    if (EXACT_ACTIONS[key]) return EXACT_ACTIONS[key]

    if (key.includes('suspend') || key.includes('reject') || key.includes('delete') || key.includes('cancel')) {
        return { label: 'Ação administrativa restritiva', tone: 'negative' }
    }
    if (key.includes('active') || key.includes('approve') || key.includes('complete')) {
        return { label: 'Ação administrativa de ativação', tone: 'positive' }
    }
    if (key.includes('update') || key.includes('edit') || key.includes('change')) {
        return { label: 'Dados atualizados no painel', tone: 'info' }
    }
    if (key.includes('create') || key.includes('add') || key.includes('new')) {
        return { label: 'Registo criado no painel', tone: 'info' }
    }
    return { label: 'Ação administrativa registada', tone: 'neutral' }
}

export default describeAuditAction
