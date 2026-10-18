import { useState } from 'react'
import { submitRequiredReason } from '../services/statusReasonAction'
import { X, AlertCircle } from 'lucide-react'

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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
            role="presentation"
            onMouseDown={event => {
                if (event.target === event.currentTarget && !pending) onClose()
            }}
        >
            <form
                className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(233,30,99,0.22)] border border-pink-100 ring-1 ring-pink-500/15 animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="status-reason-title"
                onSubmit={submit}
            >
                {/* Branded pink gradient top bar */}
                <div className="h-2 w-full bg-gradient-to-r from-[#E91E63] via-[#FF2E93] to-[#880E4F]" />

                {/* Close Button */}
                <button
                    type="button"
                    disabled={pending}
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
                    aria-label="Fechar"
                >
                    <X size={16} />
                </button>

                <div className="p-6 sm:p-8">
                    <h2 id="status-reason-title" className="text-xl font-bold text-slate-900 mb-1.5">
                        {title}
                    </h2>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        {description} O motivo ficará registado no log de auditoria da plataforma.
                    </p>

                    <label htmlFor="status-reason" className="block text-xs font-semibold text-slate-700 mb-2">
                        Motivo da alteração
                    </label>
                    <textarea
                        id="status-reason"
                        autoFocus
                        required
                        maxLength={500}
                        rows={4}
                        value={reason}
                        onChange={event => setReason(event.target.value)}
                        disabled={pending}
                        placeholder="Explique detalhadamente por que esta ação é necessária..."
                        className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] resize-none transition-all"
                    />

                    {error && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 mt-2" role="alert">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            disabled={pending}
                            onClick={onClose}
                            className="py-2.5 px-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={pending || !reason.trim()}
                            className="py-2.5 px-5 rounded-full bg-gradient-to-r from-[#E91E63] to-[#D81B60] text-white text-xs font-semibold shadow-md shadow-pink-500/25 hover:opacity-95 transition-all disabled:opacity-50"
                        >
                            {pending ? 'A guardar…' : confirmLabel}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
