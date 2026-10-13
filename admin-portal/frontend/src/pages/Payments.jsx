import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Wallet, CheckCircle2, Clock3, Search } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const STATUS = {
    pending: { label: 'Pendente', color: '#b45309', background: '#fef3c7' },
    confirmed: { label: 'Confirmado', color: '#047857', background: '#d1fae5' },
}

export default function Payments({ onBack }) {
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const fetchPayments = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/admin/payments`)
            setPayments(Array.isArray(response.data) ? response.data : [])
        } catch {
            toast.error('Não foi possível carregar a conciliação de pagamentos.')
        } finally { setLoading(false) }
    }, [])

    useEffect(() => {
        fetchPayments()
        const interval = setInterval(fetchPayments, 30000)
        return () => clearInterval(interval)
    }, [fetchPayments])

    const pendingCount = payments.filter(payment => payment.status === 'pending').length
    const confirmedTotal = payments.filter(payment => payment.status === 'confirmed')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const filtered = payments.filter(payment => {
        const tripId = payment.trip_id || payment.trips?.id || ''
        const names = [payment.trips?.profiles_trips_client_idToprofiles?.full_name, payment.trips?.profiles_trips_driver_idToprofiles?.full_name, payment.profiles?.full_name]
            .filter(Boolean).join(' ').toLocaleLowerCase()
        return tripId.toLocaleLowerCase().includes(search.toLocaleLowerCase()) || names.includes(search.toLocaleLowerCase())
    })

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area"><h2>Conciliação de pagamentos</h2><p>Estado persistido das cobranças em numerário · atualização a cada 30 segundos</p></div>
                </div>
                <button className="btn-approve-big" onClick={fetchPayments} disabled={loading}><RefreshCw size={16} /> Atualizar</button>
            </div>

            <div className="admin-stats-grid" style={{ marginTop: 24 }}>
                <div className="admin-stat-card"><div className="stat-icon amber"><Clock3 size={22} /></div><div className="stat-info"><span className="label">Pendentes</span><span className="value">{pendingCount}</span></div></div>
                <div className="admin-stat-card"><div className="stat-icon emerald"><CheckCircle2 size={22} /></div><div className="stat-info"><span className="label">Confirmados</span><span className="value">{payments.length - pendingCount}</span></div></div>
                <div className="admin-stat-card"><div className="stat-icon pink"><Wallet size={22} /></div><div className="stat-info"><span className="label">Cash confirmado</span><span className="value">Kz {confirmedTotal.toLocaleString('pt-AO')}</span></div></div>
            </div>

            <div className="search-bar-premium" style={{ margin: '20px 0', maxWidth: 460 }}><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por viagem, cliente ou motorista" /></div>

            <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead><tr>{['Viagem', 'Cliente', 'Motorista', 'Valor', 'Método', 'Estado', 'Confirmado por', 'Data da confirmação'].map(label => <th key={label} style={{ textAlign: 'left', padding: 14, color: '#64748b', fontSize: 12 }}>{label}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(payment => {
                            const status = STATUS[payment.status] || { label: payment.status, color: '#475569', background: '#f1f5f9' }
                            return <tr key={payment.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td style={{ padding: 14 }}>#{(payment.trips?.id || payment.trip_id).slice(0, 8).toUpperCase()}</td>
                                <td style={{ padding: 14 }}>{payment.trips?.profiles_trips_client_idToprofiles?.full_name || '—'}</td>
                                <td style={{ padding: 14 }}>{payment.trips?.profiles_trips_driver_idToprofiles?.full_name || '—'}</td>
                                <td style={{ padding: 14, fontWeight: 700 }}>Kz {Number(payment.amount).toLocaleString('pt-AO')}</td>
                                <td style={{ padding: 14 }}>{payment.method === 'cash' ? 'Numerário' : payment.method}</td>
                                <td style={{ padding: 14 }}><span style={{ color: status.color, background: status.background, padding: '5px 9px', borderRadius: 20 }}>{status.label}</span></td>
                                <td style={{ padding: 14 }}>{payment.profiles?.full_name || '—'}</td>
                                <td style={{ padding: 14 }}>{payment.confirmed_at ? new Date(payment.confirmed_at).toLocaleString('pt-AO') : '—'}</td>
                            </tr>
                        })}
                        {!loading && filtered.length === 0 && <tr><td colSpan="8" style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Nenhum registo de pagamento encontrado.</td></tr>}
                        {loading && <tr><td colSpan="8" style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>A carregar pagamentos…</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
