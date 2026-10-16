import { useState, useEffect, useRef } from 'react'
import {
    Search,
    Clock,
    ArrowLeft,
    Navigation,
    User,
    RefreshCw,
    ChevronRight,
    Download,
    FileText,
} from 'lucide-react'
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import { hasReceiptFile } from '../services/adminPortalContracts'
import { buildTripsQuery, normalizeTripsPage } from '../services/adminTripsPagination'
import { formatKz, formatDateTime } from '../services/format'
import RubberSegment from '../components/react-bits/RubberSegment'

/* O estado é o único sítio onde a cor significa algo, e o tom vem daqui.
   Antes cada estado trazia um hex e um fundo próprios, e o "Cancelada" usava
   a mesma família de cor da marca. */
const STATUS_META = {
    requested: { label: 'A aguardar', tone: 'waiting', live: true },
    accepted: { label: 'Aceite', tone: 'accepted', live: true },
    arrived: { label: 'Chegou', tone: 'accepted', live: true },
    ongoing: { label: 'Em curso', tone: 'live', live: true },
    completed: { label: 'Concluída', tone: 'done', live: false },
    cancelled: { label: 'Cancelada', tone: 'cancelled', live: false },
}

const TABS = [
    { key: 'all', label: 'Todas' },
    { key: 'live', label: 'Ativas', live: true },
    { key: 'completed', label: 'Concluídas' },
    { key: 'cancelled', label: 'Canceladas' },
]

const initialsOf = name => String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')

export default function Trips({ onBack }) {
    const [trips, setTrips] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTrip, setSelectedTrip] = useState(null)
    const [liveCount, setLiveCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalTrips, setTotalTrips] = useState(0)
    const [fetchError, setFetchError] = useState('')
    const itemsPerPage = 20
    const latestRequest = useRef(0)

    const fetchTrips = async (page = currentPage, status = activeTab, search = searchTerm) => {
        const requestId = ++latestRequest.current
        setLoading(true)
        try {
            const res = await adminApi.get('/admin/trips', { params: buildTripsQuery({ page, pageSize: itemsPerPage, status, search }) })
            const data = normalizeTripsPage(res.data)
            if (requestId !== latestRequest.current) return
            setTrips(data.items)
            setTotalTrips(data.total)
            setCurrentPage(data.page)
            setLiveCount(data.items.filter(t => STATUS_META[t.status]?.live).length)
            setFetchError('')
        } catch (error) {
            if (requestId !== latestRequest.current) return
            console.error('Error fetching trips:', error)
            setFetchError('Não foi possível atualizar as corridas. Os dados anteriores continuam visíveis, se disponíveis.')
            toast.error('Erro ao carregar corridas')
        } finally {
            if (requestId === latestRequest.current) setLoading(false)
        }
    }

    useEffect(() => {
        setCurrentPage(1)
    }, [activeTab, searchTerm])

    useEffect(() => {
        const debounce = setTimeout(() => fetchTrips(currentPage, activeTab, searchTerm), 300)
        const recovery = setInterval(() => fetchTrips(currentPage, activeTab, searchTerm), 30000)
        return () => { clearTimeout(debounce); clearInterval(recovery) }
    }, [currentPage, activeTab, searchTerm])

    const totalPages = Math.ceil(totalTrips / itemsPerPage)
    const statusMeta = status => STATUS_META[status] || { label: status || 'Sem estado', tone: 'neutral', live: false }

    const renderPagination = () => {
        if (loading || totalTrips === 0) return null
        const pages = []
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i)
        } else {
            pages.push(1)
            if (currentPage > 3) pages.push('...')
            const start = Math.max(2, currentPage - 1)
            const end = Math.min(totalPages - 1, currentPage + 1)
            for (let i = start; i <= end; i++) {
                if (pages[pages.length - 1] !== i) pages.push(i)
            }
            if (currentPage < totalPages - 2) pages.push('...')
            if (pages[pages.length - 1] !== totalPages) pages.push(totalPages)
        }

        return (
            <nav className="tot-pagination" aria-label="Paginação das corridas">
                <button
                    type="button"
                    className="tot-pagination-button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    Anterior
                </button>
                {pages.map((page, index) => page === '...' ? (
                    <span key={`gap-${index}`} className="tot-pagination-gap">…</span>
                ) : (
                    <button
                        key={page}
                        type="button"
                        className={`tot-pagination-button ${currentPage === page ? 'is-current' : ''}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                        onClick={() => setCurrentPage(page)}
                    >
                        {page}
                    </button>
                ))}
                <button
                    type="button"
                    className="tot-pagination-button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                >
                    Seguinte
                </button>
                <span className="tot-pagination-status">
                    Página {currentPage} de {Math.max(totalPages, 1)} · {totalTrips} resultados
                </span>
            </nav>
        )
    }

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="module-header-left">
                    <button type="button" className="btn-back-square" onClick={onBack} aria-label="Voltar ao painel">
                        <ArrowLeft size={19} aria-hidden="true" />
                    </button>
                    <div className="title-area">
                        <h2 className="title-with-icon">
                            <Navigation size={20} aria-hidden="true" /> Corridas
                        </h2>
                        <p>
                            {totalTrips} {totalTrips === 1 ? 'corrida' : 'corridas'} no total
                            {liveCount > 0 && ` · ${liveCount} ${liveCount === 1 ? 'ativa' : 'ativas'} nesta página`}
                        </p>
                    </div>
                </div>
                <div className="header-actions">
                    <label className="tot-search">
                        <Search size={17} aria-hidden="true" />
                        <span className="tot-sr-only">Buscar corridas</span>
                        <input
                            type="search"
                            placeholder="Buscar cliente, motorista ou ID…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </label>
                    <button
                        type="button"
                        className="tot-btn tot-btn--icon"
                        onClick={() => fetchTrips()}
                        disabled={loading}
                        aria-label="Atualizar corridas"
                    >
                        <RefreshCw size={17} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="trip-filter-control">
                <RubberSegment
                    items={TABS.map(({ key, label }) => ({ value: key, label }))}
                    value={activeTab}
                    onChange={value => { setCurrentPage(1); setActiveTab(value) }}
                    aria-label="Filtrar corridas por estado"
                    size="lg"
                    radius={8}
                    inset={3}
                    stretch={110}
                    squash={0}
                    draggable={false}
                    className="trip-filter-segment"
                />
            </div>

            {fetchError && (
                <div className="tot-alert" role="alert">
                    <span>{fetchError}</span>
                    <button type="button" className="tot-btn tot-btn--sm" onClick={() => fetchTrips()} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" /> Tentar novamente
                    </button>
                </div>
            )}

            <div className="admin-record-list trips-record-list">
                <div className="admin-record-list-head trips-record-head" aria-hidden="true">
                    <span>Cliente e percurso</span>
                    <span>Estado</span>
                    <span>Valor</span>
                    <span>Ações</span>
                </div>

                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="admin-record-row admin-record-loading trip-record-row" role="status" aria-label="A carregar corridas">
                            <span /><span /><span /><span />
                        </div>
                    ))
                ) : trips.length > 0 ? (
                    trips.map(trip => {
                        const meta = statusMeta(trip.status)
                        const client = trip.profiles_trips_client_idToprofiles?.full_name || 'Cliente não identificado'
                        const driver = trip.profiles_trips_driver_idToprofiles?.full_name
                        const fare = trip.final_fare || trip.estimated_fare || 0
                        return (
                            <div key={trip.id} className={`admin-record-row trip-record-row ${meta.live ? 'is-live' : ''}`}>
                                <div className="card-left-section">
                                    <span className="avatar-box" aria-hidden="true">{initialsOf(client)}</span>
                                    <div className="info-group">
                                        <h3>{client}</h3>
                                        <p>
                                            <User size={12} aria-hidden="true" />
                                            {driver || 'Aguarda motorista'}
                                        </p>
                                        <div className="trip-route">
                                            <div className="trip-route-stop">
                                                <span className="trip-route-label">Origem</span>
                                                <span className="trip-route-value">{trip.origin_address || 'Endereço não registado'}</span>
                                            </div>
                                            <div className="trip-route-stop">
                                                <span className="trip-route-label">Destino</span>
                                                <span className="trip-route-value">{trip.dest_address || 'Endereço não registado'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <span className={`status-pill status-pill--${meta.tone} trip-record-state`}>{meta.label}</span>

                                <span className="trip-record-fare">{formatKz(fare)}</span>

                                <div className="record-actions">
                                    <button
                                        type="button"
                                        className="record-action"
                                        onClick={() => setSelectedTrip(trip)}
                                        aria-label={`Ver detalhes da corrida de ${client}`}
                                    >
                                        Detalhes <ChevronRight size={15} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="empty-state-container">
                        <Clock size={28} aria-hidden="true" />
                        <strong>{searchTerm ? 'Nenhuma corrida corresponde à busca' : 'Sem corridas neste filtro'}</strong>
                        <p>
                            {searchTerm
                                ? 'Experimente outro nome, ID ou limpe a busca para ver todas as corridas.'
                                : 'Escolha outro estado no filtro para ver as corridas já registadas.'}
                        </p>
                    </div>
                )}
            </div>

            {renderPagination()}

            {selectedTrip && (
                <div className="receipt-overlay animate-fade-in" onClick={() => setSelectedTrip(null)}>
                    <div className="receipt-modal" role="dialog" aria-modal="true" aria-label="Detalhes da corrida" onClick={e => e.stopPropagation()}>
                        <div className="receipt-header">
                            <FileText size={26} aria-hidden="true" />
                            <h3>Detalhes da corrida</h3>
                            <p>#{String(selectedTrip.id).slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div className="receipt-body">
                            {[
                                ['Cliente', selectedTrip.profiles_trips_client_idToprofiles?.full_name || 'Não identificado'],
                                ['Motorista', selectedTrip.profiles_trips_driver_idToprofiles?.full_name || 'Sem motorista'],
                                ['Estado', statusMeta(selectedTrip.status).label],
                                ['Registada', formatDateTime(selectedTrip.created_at)],
                            ].map(([label, value]) => (
                                <div key={label} className="receipt-row">
                                    <label>{label}</label>
                                    <span>{value}</span>
                                </div>
                            ))}
                            <div className="receipt-divider" />
                            <div className="receipt-row">
                                <label>Origem</label>
                                <span className="receipt-value">{selectedTrip.origin_address || 'Não registada'}</span>
                            </div>
                            <div className="receipt-row">
                                <label>Destino</label>
                                <span className="receipt-value">{selectedTrip.dest_address || 'Não registado'}</span>
                            </div>
                            {selectedTrip.payment_method && (
                                <div className="receipt-row">
                                    <label>Pagamento</label>
                                    <span>{selectedTrip.payment_method}</span>
                                </div>
                            )}
                            <div className="receipt-divider" />
                            <div className="receipt-total">
                                <span className="total-label">Total</span>
                                <span className="total-value">{formatKz(selectedTrip.final_fare || selectedTrip.estimated_fare || 0)}</span>
                            </div>
                        </div>
                        <div className="receipt-actions">
                            {hasReceiptFile(selectedTrip.invoices?.find(invoice => invoice.pdf_url)?.pdf_url) ? (
                                <a
                                    className="tot-btn tot-btn--soft"
                                    href={selectedTrip.invoices.find(invoice => invoice.pdf_url).pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                >
                                    <Download size={17} aria-hidden="true" /> Baixar PDF
                                </a>
                            ) : (
                                <button type="button" className="tot-btn" disabled title="O backend ainda não gera ficheiros PDF">
                                    <Download size={17} aria-hidden="true" /> PDF indisponível
                                </button>
                            )}
                            <button type="button" className="tot-btn tot-btn--primary" onClick={() => setSelectedTrip(null)}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
