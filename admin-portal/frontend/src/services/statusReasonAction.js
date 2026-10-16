export async function submitRequiredReason({ reason, action, setPending, setError, onSuccess }) {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : ''
    if (!normalizedReason) {
        setError('Informe um motivo para continuar.')
        return false
    }

    setError('')
    setPending(true)
    try {
        await action(normalizedReason)
        onSuccess()
        return true
    } catch (error) {
        const message = error?.response?.data?.message
        setError(Array.isArray(message) ? message.join(' ') : message || error?.message || 'Não foi possível concluir a ação.')
        return false
    } finally {
        setPending(false)
    }
}
