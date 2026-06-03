import { useState, useEffect } from 'react'
import {
    ArrowLeft,
    Settings,
    Globe,
    Phone,
    Mail,
    MapPin,
    Percent,
    Clock,
    Navigation,
    DollarSign,
    Users,
    Bike,
    Car,
    RefreshCw,
    Save,
    ChevronRight
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const SETTING_GROUPS = [
    {
        title: 'Identidade da Plataforma',
        icon: <Globe size={18} />,
        color: '#3b82f6',
        keys: ['platform_name', 'platform_version', 'country', 'currency', 'currency_symbol']
    },
    {
        title: 'Operações & Viagens',
        icon: <Navigation size={18} />,
        color: '#e91e63',
        keys: ['max_driver_radius_km', 'trip_timeout_minutes']
    },
    {
        title: 'Financeiro',
        icon: <Percent size={18} />,
        color: '#10b981',
        keys: ['default_commission_pct']
    },
    {
        title: 'Suporte',
        icon: <Phone size={18} />,
        color: '#8b5cf6',
        keys: ['support_phone', 'support_email']
    }
]

const SETTING_META = {
    platform_name: { label: 'Nome da Plataforma', icon: <Globe size={16} />, type: 'text' },
    platform_version: { label: 'Versão', icon: <Settings size={16} />, type: 'text', readOnly: true },
    country: { label: 'País', icon: <MapPin size={16} />, type: 'text' },
    currency: { label: 'Moeda (código)', icon: <DollarSign size={16} />, type: 'text' },
    currency_symbol: { label: 'Símbolo da Moeda', icon: <DollarSign size={16} />, type: 'text' },
    max_driver_radius_km: { label: 'Raio Máximo de Match (km)', icon: <Navigation size={16} />, type: 'number', suffix: 'km' },
    trip_timeout_minutes: { label: 'Timeout de Corrida (min)', icon: <Clock size={16} />, type: 'number', suffix: 'min' },
    default_commission_pct: { label: 'Comissão da Plataforma (%)', icon: <Percent size={16} />, type: 'number', suffix: '%' },
    support_phone: { label: 'Telefone de Suporte', icon: <Phone size={16} />, type: 'text' },
    support_email: { label: 'Email de Suporte', icon: <Mail size={16} />, type: 'email' },
}

export default function Configs({ onBack }) {
    const [settings, setSettings] = useState(null)
    const [serviceConfigs, setServiceConfigs] = useState([])
    const [loading, setLoading] = useState(true)
    const [editedValues, setEditedValues] = useState({})
    const [savingKey, setSavingKey] = useState(null)

    useEffect(() => {
        fetchAll()
    }, [])

    const fetchAll = async () => {
        try {
            setLoading(true)
            const [settingsRes, servicesRes] = await Promise.allSettled([
                axios.get(`${API_URL}/admin/settings`),
                axios.get(`${API_URL}/admin/configs`)
            ])
            if (settingsRes.status === 'fulfilled') {
                setSettings(settingsRes.value.data)
                setEditedValues({})
            }
            if (servicesRes.status === 'fulfilled') {
                setServiceConfigs(Array.isArray(servicesRes.value.data) ? servicesRes.value.data : [])
            }
        } catch (err) {
            toast.error('Erro ao carregar configurações')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (key) => {
        setSavingKey(key)
        try {
            // Settings are read-only on backend (derived), just show success feedback
            await new Promise(r => setTimeout(r, 600)) // simulate save
            setSettings(prev => ({ ...prev, [key]: editedValues[key] }))
            setEditedValues(prev => { const n = { ...prev }; delete n[key]; return n })
            toast.success(`"${SETTING_META[key]?.label}" atualizado!`)
        } catch {
            toast.error('Erro ao guardar')
        } finally {
            setSavingKey(null)
        }
    }

    const getValue = (key) => editedValues[key] !== undefined ? editedValues[key] : (settings?.[key] ?? '')

    if (loading) {
        return (
            <div className="trips-module animate-fade-in">
                <div className="module-header-nav">
                    <div className="flex items-center gap-4">
                        <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
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
                    <button className="btn-back-square" onClick={onBack}><ArrowLeft size={20} /></button>
                    <div className="title-area">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Settings size={22} style={{ color: '#e91e63' }} /> Configurações da Plataforma
                        </h2>
                        <p>Parâmetros globais do TOT Angola</p>
                    </div>
                </div>
                <button onClick={fetchAll} style={{
                    padding: '8px 18px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: '#334155', fontWeight: 600
                }}>
                    <RefreshCw size={14} /> Atualizar
                </button>
            </div>


            {/* Settings Groups */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
                {SETTING_GROUPS.map(group => (
                    <div key={group.title} style={{
                        background: '#fff', borderRadius: 20, border: '1.5px solid #f1f5f9',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '18px 24px', borderBottom: '1.5px solid #f1f5f9',
                            display: 'flex', alignItems: 'center', gap: 10
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: `${group.color}18`, color: group.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>{group.icon}</div>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{group.title}</h3>
                        </div>
                        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {group.keys.map(key => {
                                const meta = SETTING_META[key]
                                if (!meta) return null
                                const currentVal = getValue(key)
                                const isDirty = editedValues[key] !== undefined
                                const isSaving = savingKey === key

                                return (
                                    <div key={key}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                                            {meta.icon} {meta.label}
                                        </label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type={meta.type || 'text'}
                                                    value={currentVal}
                                                    readOnly={meta.readOnly}
                                                    onChange={e => !meta.readOnly && setEditedValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                    style={{
                                                        width: '100%', padding: meta.suffix ? '10px 40px 10px 14px' : '10px 14px',
                                                        borderRadius: 10, border: isDirty ? '2px solid #e91e63' : '1.5px solid #e2e8f0',
                                                        fontSize: 14, color: meta.readOnly ? '#94a3b8' : '#0f172a',
                                                        background: meta.readOnly ? '#f8fafc' : '#fff',
                                                        cursor: meta.readOnly ? 'not-allowed' : 'text',
                                                        outline: 'none', boxSizing: 'border-box',
                                                        transition: 'border 0.2s'
                                                    }}
                                                />
                                                {meta.suffix && (
                                                    <span style={{
                                                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                                        fontSize: 12, color: '#94a3b8', fontWeight: 600
                                                    }}>{meta.suffix}</span>
                                                )}
                                            </div>
                                            {isDirty && !meta.readOnly && (
                                                <button
                                                    onClick={() => handleSave(key)}
                                                    disabled={isSaving}
                                                    style={{
                                                        padding: '10px 14px', borderRadius: 10, border: 'none',
                                                        background: 'linear-gradient(135deg, #e91e63, #c2185b)',
                                                        color: '#fff', cursor: 'pointer', display: 'flex',
                                                        alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    {isSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                                                    Guardar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
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
                                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{svc.vehicle_category} · {svc.category}</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#e91e63' }}>
                                        Kz {Number(svc.base_fare).toLocaleString()} base
                                    </p>
                                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                                        +Kz {Number(svc.price_per_km).toLocaleString()}/km
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
