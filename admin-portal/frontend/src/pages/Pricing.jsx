import { useState, useEffect } from 'react'
import {
    Settings,
    Save,
    ArrowLeft,
    DollarSign,
    Zap,
    MapPin,
    Clock,
    Percent,
    ShieldCheck,
    Car,
    Bike,
    Plus,
    Trash2,
    Package,
    Truck,
    Camera,
    Info,
    Image as ImageIcon,
    X
} from 'lucide-react'
import adminApi from '../services/adminApi'
import toast from 'react-hot-toast'
import { buildPricingServicePayload, isPricingServiceDirty, normalizePricingService, normalizeVehicleCategory, formatVehicleCategory } from '../services/pricingForm.js'


export default function Pricing({ onBack }) {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editingService, setEditingService] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [formError, setFormError] = useState('')
    const [servicesError, setServicesError] = useState('')
    const [originalService, setOriginalService] = useState(null)
    const [previewRoute, setPreviewRoute] = useState({ originLat: '', originLng: '', destLat: '', destLng: '' })
    const [quotePreview, setQuotePreview] = useState(null)
    const [previewKey, setPreviewKey] = useState('')
    const [previewing, setPreviewing] = useState(false)

    const initialServiceState = {
        name: '',
        category: 'ride',
        service_type: 'express',
        vehicle_category: 'car',
        routing_mode: 'car',
        description: '',
        image_url: '',
        base_fare: 500,
        price_per_km: 150,
        price_per_min: 10,
        min_fare: 700,
        platform_fee_type: 'percentage',
        platform_fee_value: 15
    }

    useEffect(() => {
        fetchServices()
    }, [])

    const fetchServices = async () => {
        try {
            setLoading(true)
            const res = await adminApi.get('/admin/configs')
            if (!Array.isArray(res.data)) throw new Error('Resposta inválida ao carregar serviços')
            setServices(res.data.map(normalizePricingService))
            setServicesError('')
        } catch (error) {
            console.error('Error fetching services:', error)
            setServicesError('Erro ao carregar serviços. Verifique a ligação e tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        let payload
        try {
            payload = buildPricingServicePayload(editingService)
            setFormError('')
        } catch (error) {
            setFormError(error.message)
            return
        }

        const hasPricingChange = editingService.id && ['base_fare', 'price_per_km', 'price_per_min', 'min_fare'].some(key => Number(editingService[key]) !== Number(originalService?.[key]))
        const currentPreviewKey = JSON.stringify({ ...previewRoute, proposed: {
            base_fare: payload.base_fare, price_per_km: payload.price_per_km,
            price_per_min: payload.price_per_min, min_fare: payload.min_fare,
        } })
        if (hasPricingChange && (!quotePreview || previewKey !== currentPreviewKey)) {
            setFormError('Faça uma simulação da tarifa com a rota actual antes de confirmar a alteração.')
            return
        }
        if (hasPricingChange && !window.confirm(`Confirmar a alteração de tarifa?\n\nRota: ${(quotePreview.distanceMeters / 1000).toFixed(1)} km, ${(quotePreview.durationSeconds / 60).toFixed(0)} min\nAntes: ${Number(quotePreview.currentFare).toLocaleString('pt-AO')} Kz\nDepois: ${Number(quotePreview.proposedFare).toLocaleString('pt-AO')} Kz`)) return

        try {
            setSaving(true)
            if (editingService.id) {
                await adminApi.post(`/admin/services/${editingService.id}`, payload)
                toast.success('Serviço atualizado com sucesso!')
            } else {
                await adminApi.post('/admin/services', payload)
                toast.success('Serviço criado com sucesso!')
            }
            setShowModal(false)
            fetchServices()
        } catch (error) {
            const message = error.response?.data?.message || 'Erro ao salvar serviço. Corrija o problema e tente novamente.'
            setFormError(Array.isArray(message) ? message.join(', ') : message)
            toast.error('Erro ao salvar serviço')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este serviço?')) return
        try {
            setSaving(true)
            await adminApi.post(`/admin/services/${id}/delete`)
            toast.success('Serviço excluído com sucesso!')
            fetchServices()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Erro ao excluir serviço')
        } finally {
            setSaving(false)
        }
    }

    const openCreateModal = () => {
        setFormError('')
        setOriginalService({ ...initialServiceState })
        setQuotePreview(null); setPreviewKey(''); setPreviewRoute({ originLat: '', originLng: '', destLat: '', destLng: '' })
        setEditingService({ ...initialServiceState })
        setShowModal(true)
    }

    const openEditModal = (service) => {
        setFormError('')
        setOriginalService({ ...service })
        setQuotePreview(null); setPreviewKey(''); setPreviewRoute({ originLat: '', originLng: '', destLat: '', destLng: '' })
        setEditingService({ ...service })
        setShowModal(true)
    }

    const handleQuotePreview = async () => {
        if (!editingService?.id) return
        let payload
        try { payload = buildPricingServicePayload(editingService) }
        catch (error) { setFormError(error.message); return }
        const proposed = Object.fromEntries(['base_fare', 'price_per_km', 'price_per_min', 'min_fare'].map(key => [key, payload[key]]))
        const key = JSON.stringify({ ...previewRoute, proposed })
        try {
            setPreviewing(true); setFormError('')
            const response = await adminApi.post(`/admin/services/${editingService.id}/quote-preview`, { ...previewRoute, proposed })
            if (!response.data || !Number.isFinite(response.data.distanceMeters) || !Number.isFinite(response.data.durationSeconds)
                || !Number.isFinite(Number(response.data.currentFare)) || !Number.isFinite(Number(response.data.proposedFare))) throw new Error('Resposta de simulação inválida.')
            setQuotePreview(response.data); setPreviewKey(key)
        } catch (error) {
            setQuotePreview(null); setPreviewKey('')
            const message = error.adminApiError?.message || error.response?.data?.message || error.message || 'Não foi possível simular a rota.'
            setFormError(Array.isArray(message) ? message.join(', ') : message)
        } finally { setPreviewing(false) }
    }

    const closeModal = () => {
        if (isPricingServiceDirty(originalService, editingService) && !window.confirm('Descartar as alterações não guardadas?')) return
        setShowModal(false)
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        try {
            setUploading(true)
            setUploadProgress(0)
            const res = await adminApi.post('/admin/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: event => {
                    if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
                },
            })
            setEditingService({ ...editingService, image_url: res.data.url })
            toast.success('Imagem enviada com sucesso!')
        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Erro ao enviar imagem')
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const getIcon = (category, vehicle) => {
        if (category === 'delivery') return <Package size={24} />
        const normalized = normalizeVehicleCategory(vehicle)
        if (normalized === 'moto') return <Bike size={24} />
        if (normalized === 'truck' || normalized === 'van') return <Truck size={24} />
        return <Car size={24} />
    }

    return (
        <div className="pricing-module animate-fade-in">
            <div className="module-header-nav flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="title-area">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Gestão de Serviços & Tarifas
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Configure categorias, veículos e regras de preço
                        </p>
                    </div>
                </div>

                <div className="header-actions">
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#E91E63] to-[#D81B60] hover:from-[#D81B60] hover:to-[#C2185B] text-white text-xs font-bold tracking-wide shadow-md shadow-pink-500/25 hover:shadow-lg hover:shadow-pink-500/30 transition-all cursor-pointer flex items-center justify-center"
                    >
                        Novo Serviço
                    </button>
                </div>
            </div>

            {servicesError && !loading && (
                <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between mt-6">
                    <p className="font-medium">{servicesError}</p>
                    <button className="font-bold underline hover:no-underline cursor-pointer" onClick={fetchServices}>TENTAR NOVAMENTE</button>
                </div>
            )}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-80 rounded-[26px] bg-slate-100 animate-pulse"></div>)}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-6">
                    {services.map(service => (
                        <div
                            key={service.id}
                            className="relative bg-white rounded-[26px] overflow-hidden border border-pink-100/80 shadow-[0_10px_30px_-5px_rgba(233,30,99,0.08)] hover:shadow-[0_15px_35px_-5px_rgba(233,30,99,0.18)] transition-all flex flex-col group"
                        >
                            {/* Premium Pink Gradient Header */}
                            <div className="bg-gradient-to-br from-[#E91E63] via-[#D81B60] to-[#C2185B] p-5 text-white relative">
                                <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />

                                <div className="flex items-start justify-between gap-3 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner overflow-hidden relative">
                                            {service.image_url ? (
                                                <img
                                                    src={service.image_url}
                                                    alt={service.name}
                                                    className="w-full h-full object-cover"
                                                    onError={e => {
                                                        e.currentTarget.style.display = 'none'
                                                        const fallback = e.currentTarget.nextElementSibling
                                                        if (fallback) fallback.style.display = 'flex'
                                                    }}
                                                />
                                            ) : null}
                                            <div className={service.image_url ? 'hidden items-center justify-center' : 'flex items-center justify-center'}>
                                                {getIcon(service.category, service.vehicle_category)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="font-black text-sm text-white m-0 tracking-tight">
                                                    {service.name || 'Sem Nome'}
                                                </h3>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white/25 text-white backdrop-blur-xs">
                                                    {service.category === 'ride' ? 'Corrida' : 'Entrega'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white/15 text-white/95 backdrop-blur-xs">
                                                    {formatVehicleCategory(service.vehicle_category)}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-white/80 font-medium m-0 mt-0.5 truncate max-w-[170px]">
                                                {service.description || 'Sem descrição'}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(service.id)}
                                        className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                        title="Excluir serviço"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Card Body: Pricing Parameters & Action */}
                            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="p-2.5 rounded-2xl bg-pink-50/50 border border-pink-100 flex flex-col">
                                        <span className="text-[10px] font-bold text-pink-700/70 uppercase tracking-wider">
                                            Base
                                        </span>
                                        <span className="text-slate-900 font-extrabold text-xs sm:text-sm mt-0.5">
                                            {Number(service.base_fare).toLocaleString()} Kz
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-2xl bg-pink-50/50 border border-pink-100 flex flex-col">
                                        <span className="text-[10px] font-bold text-pink-700/70 uppercase tracking-wider">
                                            Por KM
                                        </span>
                                        <span className="text-slate-900 font-extrabold text-xs sm:text-sm mt-0.5">
                                            {Number(service.price_per_km).toLocaleString()} Kz
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-2xl bg-pink-50/50 border border-pink-100 flex flex-col">
                                        <span className="text-[10px] font-bold text-pink-700/70 uppercase tracking-wider">
                                            Mínimo
                                        </span>
                                        <span className="text-slate-900 font-extrabold text-xs sm:text-sm mt-0.5">
                                            {Number(service.min_fare).toLocaleString()} Kz
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-2xl bg-pink-50/50 border border-pink-100 flex flex-col">
                                        <span className="text-[10px] font-bold text-pink-700/70 uppercase tracking-wider">
                                            Taxa
                                        </span>
                                        <span className="text-slate-900 font-extrabold text-xs sm:text-sm mt-0.5">
                                            {service.platform_fee_value}{service.platform_fee_type === 'percentage' ? '%' : ' Kz'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => openEditModal(service)}
                                    className="w-full py-2.5 px-4 rounded-full bg-pink-50 hover:bg-gradient-to-r hover:from-[#E91E63] hover:to-[#D81B60] text-[#E91E63] hover:text-white border border-pink-200/80 hover:border-transparent text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Settings size={14} />
                                    <span>Ajustar Tarifas & Info</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={closeModal}
                >
                    <div
                        className="relative w-full max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col bg-white rounded-[32px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(233,30,99,0.25)] border border-pink-100 ring-1 ring-pink-500/15 animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Branded pink gradient top bar */}
                        <div className="h-2 w-full bg-gradient-to-r from-[#E91E63] via-[#FF2E93] to-[#880E4F] flex-shrink-0" />

                        {/* Modal Header */}
                        <div className="p-6 sm:p-7 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-pink-50 text-[#E91E63] flex items-center justify-center ring-4 ring-pink-100/60 shadow-xs">
                                    {getIcon(editingService.category, editingService.vehicle_category)}
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                        {editingService.id ? 'Editar Serviço' : 'Novo Serviço'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {isPricingServiceDirty(originalService, editingService) ? 'Alterações não salvas' : 'Defina os detalhes e as regras de cobrança do serviço'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                                onClick={closeModal}
                                aria-label="Fechar"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-6 sm:p-7 space-y-6 overflow-y-auto flex-1 min-h-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Section: Informações Básicas */}
                                <section className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col gap-4">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200/60">
                                        <Info size={15} className="text-[#E91E63]" />
                                        <span>Informações Básicas</span>
                                    </div>

                                    {/* Nome do Serviço */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            Nome do Serviço
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Moto Táxi, Entrega Express"
                                            value={editingService.name}
                                            onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all"
                                            required
                                        />
                                    </div>

                                    {/* Categoria & Tipo de Veículo */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                Categoria
                                            </label>
                                            <select
                                                value={editingService.category}
                                                onChange={e => setEditingService({ ...editingService, category: e.target.value })}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all cursor-pointer"
                                            >
                                                <option value="ride">Corrida</option>
                                                <option value="delivery">Entrega</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                Veículo
                                            </label>
                                            <select
                                                value={editingService.vehicle_category}
                                                onChange={e => {
                                                    const vehicle_category = e.target.value;
                                                    const routing_mode = /moto|motorcycle|scooter|bike/i.test(vehicle_category)
                                                        ? 'scooter'
                                                        : /truck|caminh|camião|camiao|van/i.test(vehicle_category)
                                                            ? 'truck'
                                                            : /car|automovel|automóvel/i.test(vehicle_category)
                                                                ? 'car'
                                                                : editingService.routing_mode;
                                                    setEditingService({ ...editingService, vehicle_category, routing_mode });
                                                }}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all cursor-pointer"
                                            >
                                                <option value="moto">Moto</option>
                                                <option value="car">Carro</option>
                                                <option value="van">Carrinha</option>
                                                <option value="truck">Camião</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Rota da Cotação */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            Rota na Cotação
                                        </label>
                                        <select
                                            value={editingService.routing_mode || 'car'}
                                            onChange={e => setEditingService({ ...editingService, routing_mode: e.target.value })}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all cursor-pointer"
                                        >
                                            <option value="scooter">Moto / Scooter</option>
                                            <option value="car">Automóvel (Carro)</option>
                                            <option value="truck">Camião / Carrinha</option>
                                        </select>
                                        <p className="text-[10px] text-slate-400 font-medium leading-tight">
                                            Define as vias e velocidades calculadas para a estimativa de preço.
                                        </p>
                                    </div>

                                    {/* Descrição */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            Descrição
                                        </label>
                                        <textarea
                                            placeholder="Ex: Viagem rápida e económica pela cidade..."
                                            rows="2"
                                            value={editingService.description}
                                            onChange={e => setEditingService({ ...editingService, description: e.target.value })}
                                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all resize-none"
                                        />
                                    </div>

                                    {/* Foto do Veículo (Upload Estilizado) */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <ImageIcon size={13} className="text-[#E91E63]" />
                                            <span>Foto do Veículo</span>
                                        </label>

                                        <label className="relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-pink-200 hover:border-[#E91E63] bg-pink-50/20 hover:bg-pink-50/50 transition-all cursor-pointer text-center group">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                disabled={uploading}
                                                className="hidden"
                                            />
                                            {uploading ? (
                                                <div className="flex items-center gap-2 text-xs font-bold text-[#E91E63]">
                                                    <RefreshCw size={16} className="animate-spin" />
                                                    <span>A carregar imagem... {uploadProgress}%</span>
                                                </div>
                                            ) : editingService.image_url ? (
                                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                                                    <Camera size={16} className="text-emerald-600" />
                                                    <span>Imagem carregada com sucesso</span>
                                                    <span className="text-[10px] text-slate-400 font-normal block">(Clique para trocar)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 group-hover:text-[#E91E63]">
                                                    <Camera size={16} className="text-[#E91E63]" />
                                                    <span>Clique para escolher ficheiro</span>
                                                </div>
                                            )}
                                        </label>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            * Associada ao serviço ao salvar as alterações.
                                        </p>
                                    </div>
                                </section>

                                {/* Right Section: Regras de Tarifação */}
                                <section className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col gap-4 justify-between">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200/60">
                                            <DollarSign size={15} className="text-[#E91E63]" />
                                            <span>Regras de Tarifação</span>
                                        </div>

                                        {/* Base & Mínimo */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Base (Kz)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="99999999.99"
                                                    step="0.01"
                                                    value={editingService.base_fare}
                                                    onChange={e => setEditingService({ ...editingService, base_fare: e.target.value })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Mínimo (Kz)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="99999999.99"
                                                    step="0.01"
                                                    value={editingService.min_fare}
                                                    onChange={e => setEditingService({ ...editingService, min_fare: e.target.value })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Por Km & Por Minuto */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Por Km (Kz)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="99999999.99"
                                                    step="0.01"
                                                    value={editingService.price_per_km}
                                                    onChange={e => setEditingService({ ...editingService, price_per_km: e.target.value })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Por Min (Kz)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="99999999.99"
                                                    step="0.01"
                                                    value={editingService.price_per_min}
                                                    onChange={e => setEditingService({ ...editingService, price_per_min: e.target.value })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Tipo de Taxa & Valor da Taxa */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Tipo de Taxa
                                                </label>
                                                <select
                                                    value={editingService.platform_fee_type}
                                                    onChange={e => setEditingService({ ...editingService, platform_fee_type: e.target.value })}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all cursor-pointer"
                                                >
                                                    <option value="percentage">Percentagem (%)</option>
                                                    <option value="fixed">Valor Fixo (Kz)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Valor da Taxa
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={editingService.platform_fee_type === 'percentage' ? '100' : '99999999.99'}
                                                    step="0.01"
                                                    value={editingService.platform_fee_value}
                                                    onChange={e => setEditingService({ ...editingService, platform_fee_value: e.target.value })}
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#E91E63]/30 focus:border-[#E91E63] transition-all"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {editingService.id && (
                                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
                                            <div>
                                                <span className="font-bold text-slate-800 block text-xs">Prévia da tarifa</span>
                                                <p className="text-[10px] text-slate-500 mt-1">A API calcula uma rota HERE de teste. A simulação não cria viagem nem cotação de cliente.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    ['originLat', 'Latitude de origem'], ['originLng', 'Longitude de origem'],
                                                    ['destLat', 'Latitude de destino'], ['destLng', 'Longitude de destino'],
                                                ].map(([key, label]) => (
                                                    <label key={key} className="text-[10px] font-semibold text-slate-600">
                                                        {label}
                                                        <input aria-label={label} type="number" step="any" value={previewRoute[key]}
                                                            onChange={event => { setPreviewRoute({ ...previewRoute, [key]: event.target.value }); setQuotePreview(null); setPreviewKey('') }}
                                                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" required />
                                                    </label>
                                                ))}
                                            </div>
                                            <button type="button" onClick={handleQuotePreview} disabled={previewing || saving}
                                                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                                                {previewing ? 'A calcular rota…' : 'Simular antes e depois'}
                                            </button>
                                            {quotePreview && (
                                                <div role="status" aria-live="polite" className="text-xs text-slate-700">
                                                    { (quotePreview.distanceMeters / 1000).toFixed(1) } km · { (quotePreview.durationSeconds / 60).toFixed(0) } min
                                                    <div>Antes: {Number(quotePreview.currentFare).toLocaleString('pt-AO')} Kz</div>
                                                    <div>Depois: {Number(quotePreview.proposedFare).toLocaleString('pt-AO')} Kz</div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Dica de Resumo */}
                                    <div className="p-3.5 rounded-xl bg-pink-50/50 border border-pink-100/70 text-slate-600 text-xs">
                                        <span className="font-bold text-[#E91E63] block mb-0.5">Cálculo da Tarifa</span>
                                        Tarifa estimada = Base + (KM × Preço/KM) + (Min × Preço/Min). O valor final nunca é inferior ao Mínimo definido.
                                    </div>
                                </section>
                            </div>

                            {formError && (
                                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                                    {formError}
                                </div>
                            )}

                            {/* Modal Footer Actions */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-7 py-2.5 rounded-full bg-gradient-to-r from-[#E91E63] to-[#D81B60] hover:from-[#D81B60] hover:to-[#C2185B] text-white text-xs font-bold shadow-md shadow-pink-500/25 hover:shadow-lg hover:shadow-pink-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    <Save size={15} />
                                    <span>{saving ? 'A guardar...' : editingService.id ? 'Atualizar Serviço' : 'Criar Serviço'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="pricing-info-alert glass mt-10">
                <ShieldCheck size={20} className="text-emerald-500" />
                <p><strong>Segurança:</strong> Alterações nas tarifas são registradas no log de auditoria e afetam apenas novas solicitações.</p>
            </div>
        </div>
    )
}
