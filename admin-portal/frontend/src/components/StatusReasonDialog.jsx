import { useState } from 'react'
import { submitRequiredReason } from '../services/statusReasonAction'

export default function StatusReasonDialog({ title, description, confirmLabel, onSubmit, onClose }) {
    const [reason, setReason] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')

    const submit = async event => {
        event.preventDefault()
        await submitRequiredReason({
            reason,
            action: onSubmit,
            setPending,
            setError,
            onSuccess: onClose,
        })
    }

    return (
        <div className="status-reason-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose() }}>
            <form className="status-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="status-reason-title" onSubmit={submit}>
                <h2 id="status-reason-title" style={{ margin: '0 0 8px', fontSize: 20 }}>{title}</h2>
                <p style={{ color: '#64748b', margin: '0 0 16px' }}>{description} O motivo ficará registado na auditoria.</p>
                <label htmlFor="status-reason" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>Motivo</label>
                <textarea id="status-reason" autoFocus required maxLength={500} rows={4} value={reason} onChange={event => setReason(event.target.value)} disabled={pending} placeholder="Explique por que esta ação é necessária" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12, resize: 'vertical' }} />
                <div aria-live="polite" style={{ minHeight: 24, color: '#dc2626', fontSize: 13, marginTop: 6 }}>{error}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <button type="button" disabled={pending} onClick={onClose}>Cancelar</button>
                    <button type="submit" disabled={pending || !reason.trim()}>{pending ? 'A guardar…' : confirmLabel}</button>
                </div>
            </form>
        </div>
    )
}
