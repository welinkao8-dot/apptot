import { useState, useEffect } from 'react'
import {
    ArrowLeft,
    Settings,
    DollarSign,
    Car,
    RefreshCw
} from 'lucide-react'
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import { formatKz, formatServiceType } from '../services/format'
import { formatVehicleCategory } from '../services/pricingForm'


export default function Configs({ onBack }) {
    const [serviceConfigs, setServiceConfigs] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)

    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        try {
            setLoading(true)
            setLoadError(false)
            const servicesRes = await adminApi.get('/admin/configs')
            if (!Array.isArray(servicesRes.data)) throw new Error('Resposta inválida de serviços.')
            setServiceConfigs(servicesRes.data)
        } catch (err) {
            console.error('Erro ao carregar configurações:', err)
            setLoadError(true)
            toast.error('Erro ao carregar configurações')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="trips-module animate-fade-in">
                <div className="module-header-nav">
                    <div className="flex items-center gap-4">
                        <div className="title-area"><h2>Configurações</h2><p>A carregar...</p></div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ background: '#fff', borderRadius: 20, padding: 24, border: '1.5px solid #f1f5f9' }}>
                            <div style={{ height: 16, background: '#f1f5f9', borderRadius: 6, width: '40%', marginBottom: 20 }} />
                            {[1, 2].map(j => <div key={j} style={{ height: 48, background: '#f8fafc', borderRadius: 10, marginBottom: 12 }} />)}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="trips-module animate-fade-in">
            <div className="module-header-nav">
                <div className="flex items-center gap-4">
                    <div className="title-area">
                        <h2>Configurações da Plataforma</h2>
                        <p>Parâmetros globais do sistema</p>
                    </div>
                </div>
                <button type="button" className="tot-btn tot-btn--primary tot-btn--icon" onClick={fetchAll} disabled={loading} aria-label="Atualizar configurações" title="Atualizar">
                    <RefreshCw size={16} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
                </button>
            </div>

            {loadError && (
                <div role="alert" style={{ marginTop: 20, padding: 14, borderRadius: 12, background: '#fff7ed', color: '#9a3412', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span>Não foi possível carregar os serviços. {serviceConfigs.length ? 'A mostrar os últimos dados carregados.' : ''}</span>
                    <button type="button" onClick={fetchAll} disabled={loading}>Tentar novamente</button>
                </div>
            )}


            <div role="status" style={{ marginTop: 20, padding: 14, borderRadius: 12, background: '#f8fafc', color: '#475569' }}>
                Esta plataforma ainda não tem configurações globais persistidas. O raio de procura, o timeout, a moeda e os contactos não estão disponíveis como parâmetros administrativos. A comissão é configurada por serviço em Tarifas.
            </div>

            {/* Service Configs Summary */}
            {serviceConfigs.length > 0 && (
                <div style={{ marginTop: 24, background: '#fff', borderRadius: 20, border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: '#e91e6318', color: '#e91e63',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}><DollarSign size={18} /></div>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Serviços Configurados</h3>
                        </div>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{serviceConfigs.length} serviços — editar em <strong>Tarifas</strong></span>
                    </div>
                    <div style={{ padding: '12px 24px' }}>
                        {serviceConfigs.map((svc, i) => (
                            <div key={svc.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 0',
                                borderBottom: i < serviceConfigs.length - 1 ? '1px solid #f8fafc' : 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {svc.image_url ? (
                                        <img src={svc.image_url} alt={svc.name} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Car size={18} style={{ color: '#94a3b8' }} />
                                        </div>
                                    )}
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{svc.name}</p>
                                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{formatVehicleCategory(svc.vehicle_category)} · {formatServiceType(svc.category, 'Categoria não registada')}</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#e91e63' }}>
                                        {formatKz(svc.base_fare)} base
                                    </p>
                                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                                        +{formatKz(svc.price_per_km)}/km
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
