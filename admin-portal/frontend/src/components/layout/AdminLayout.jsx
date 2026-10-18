import { useState } from 'react'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard,
    Navigation,
    Bike,
    Users,
    Wallet,
    History,
    FileText,
    CreditCard,
    ShieldCheck,
    Settings,
    LogOut,
    Bell,
    Search,
    ChevronDown,
    ArrowUpRight,
    Menu,
    X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const NAV_ITEMS = [
    { key: 'overview', path: '/', label: 'Visão Geral', icon: LayoutDashboard },
    { key: 'liveops', path: '/liveops', label: 'Operação', icon: Navigation, badge: 'Live' },
    { key: 'drivers', path: '/drivers', label: 'Motoristas', icon: Bike },
    { key: 'clients', path: '/clients', label: 'Clientes', icon: Users },
    { key: 'trips', path: '/trips', label: 'Corridas', icon: History },
    { key: 'pricing', path: '/pricing', label: 'Tarifas', icon: Wallet },
]

export const SECONDARY_ITEMS = [
    { key: 'invoices', path: '/invoices', label: 'Faturas', icon: FileText },
    { key: 'payments', path: '/payments', label: 'Pagamentos', icon: CreditCard },
    { key: 'auditlogs', path: '/audit-logs', label: 'Auditoria', icon: ShieldCheck },
    { key: 'configs', path: '/configs', label: 'Configurações', icon: Settings },
]

export default function AdminLayout({ children }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const allItems = [...NAV_ITEMS, ...SECONDARY_ITEMS]

    // Determine current active item based on current URL path
    const isCurrentActive = itemPath => {
        if (itemPath === '/') return location.pathname === '/' || location.pathname === '/dashboard'
        return location.pathname.startsWith(itemPath)
    }

    const handleNavigate = path => {
        navigate(path)
        setMobileMenuOpen(false)
    }

    const handleSignOut = () => {
        signOut()
        navigate('/login')
    }

    const adminInitials = (user?.name || user?.email || 'AD')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

    const isSecondaryActive = SECONDARY_ITEMS.some(item => isCurrentActive(item.path))

    return (
        <TooltipProvider delayDuration={200}>
            <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans p-4 md:p-6 lg:p-8 pt-5 md:pt-6 flex flex-col">
                {/* TOP HEADER */}
                <header className="w-full flex items-center justify-between mb-6">
                    {/* Brand / Logo (Centered above left dock menu) */}
                    <div className="w-12 lg:w-16 flex items-center justify-center">
                        <button
                            type="button"
                            onClick={() => handleNavigate('/')}
                            className="flex items-center justify-center group focus:outline-none"
                            aria-label="Início"
                        >
                            <img
                                src="/logo.png"
                                alt="Logo"
                                className="w-11 h-11 rounded-full object-contain shadow-sm group-hover:scale-105 transition-transform"
                            />
                        </button>
                    </div>

                    {/* Desktop Center Navigation Pills (React Router Links) */}
                    <nav className="admin-primary-nav hidden lg:flex items-center bg-white/95 backdrop-blur-md rounded-full px-2 py-1.5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-slate-200/70 gap-1">
                        {NAV_ITEMS.map(item => {
                            const active = isCurrentActive(item.path)
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleNavigate(item.path)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                                        active
                                            ? 'bg-slate-900 text-white shadow-sm font-semibold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                                    }`}
                                >
                                    <span>{item.label}</span>
                                    {item.badge && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                            active ? 'bg-[#E91E63] text-white' : 'bg-pink-100 text-[#E91E63]'
                                        }`}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            )
                        })}

                        {/* Extra dropdown tabs */}
                        <div className="relative group">
                            <button
                                type="button"
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                                    isSecondaryActive
                                        ? 'bg-slate-900 text-white font-semibold'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                                }`}
                            >
                                <span>Mais</span>
                                <ChevronDown size={13} />
                            </button>
                            <div className="absolute top-full right-0 w-48 pt-2 hidden group-hover:block z-50">
                                <div className="bg-white rounded-2xl p-1.5 shadow-xl border border-slate-200/80 animate-in fade-in-50 zoom-in-95">
                                    {SECONDARY_ITEMS.map(item => {
                                        const active = isCurrentActive(item.path)
                                        const Icon = item.icon
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => handleNavigate(item.path)}
                                                className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors ${
                                                    active
                                                        ? 'bg-pink-50 text-[#E91E63] font-semibold'
                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Icon size={15} />
                                                <span>{item.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </nav>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2.5">
                        {/* Live Sync Indicator */}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-full border border-slate-200/60 text-[11px] text-slate-500 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Online</span>
                        </div>

                        {/* User Profile Avatar */}
                        <div className="flex items-center gap-2 pl-1">
                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm ring-1 ring-slate-200/60 bg-pink-100 text-[#E91E63]">
                                <AvatarFallback className="font-bold text-xs bg-pink-50 text-[#E91E63]">
                                    {adminInitials}
                                </AvatarFallback>
                            </Avatar>
                        </div>

                        {/* Mobile Menu Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(prev => !prev)}
                            className="lg:hidden w-10 h-10 rounded-full bg-white border border-slate-200/70 shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
                            aria-label="Abrir navegação"
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </header>

                {/* Mobile Navigation Drawer */}
                {mobileMenuOpen && (
                    <div className="lg:hidden mb-6 bg-white rounded-3xl p-4 shadow-lg border border-slate-200/80 animate-in fade-in-50 slide-in-from-top-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2">
                            Menu de Operações
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mb-4">
                            {allItems.map(item => {
                                const active = isCurrentActive(item.path)
                                const Icon = item.icon
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => handleNavigate(item.path)}
                                        className={`px-3 py-2.5 rounded-2xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                                            active
                                                ? 'bg-slate-900 text-white font-semibold shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Icon size={16} />
                                        <span>{item.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">{user?.email || 'Admin'}</span>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
                            >
                                <LogOut size={14} />
                                <span>Sair</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* MAIN BODY WRAPPER (Left Floating Dock + Content Area) */}
                <div className="flex-1 flex gap-5 items-start">
                    {/* Left Floating Dock (Sidebar) */}
                    <aside className="hidden lg:flex flex-col items-center bg-white/95 backdrop-blur-md rounded-[32px] p-2.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/70 gap-3 sticky top-6">
                        {NAV_ITEMS.map(item => {
                            const active = isCurrentActive(item.path)
                            const Icon = item.icon
                            return (
                                <Tooltip key={item.key}>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => handleNavigate(item.path)}
                                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                                                active
                                                    ? 'bg-[#E91E63] text-white shadow-md shadow-pink-500/25 scale-105'
                                                    : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100/70'
                                            }`}
                                        >
                                            <Icon size={20} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">{item.label}</TooltipContent>
                                </Tooltip>
                            )
                        })}

                        <div className="w-6 h-px bg-slate-200/80 my-1" />

                        {SECONDARY_ITEMS.map(item => {
                            const active = isCurrentActive(item.path)
                            const Icon = item.icon
                            return (
                                <Tooltip key={item.key}>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => handleNavigate(item.path)}
                                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                                                active
                                                    ? 'bg-[#E91E63] text-white shadow-md shadow-pink-500/25 scale-105'
                                                    : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100/70'
                                            }`}
                                        >
                                            <Icon size={19} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">{item.label}</TooltipContent>
                                </Tooltip>
                            )
                        })}

                        <div className="w-6 h-px bg-slate-200/80 my-1" />

                        {/* Sign Out Button */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={handleSignOut}
                                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                    <LogOut size={19} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Terminar Sessão</TooltipContent>
                        </Tooltip>
                    </aside>

                    {/* Main Content Pane (React Router Outlet) */}
                    <main className="flex-1 w-full min-w-0">
                        {children || <Outlet />}
                    </main>
                </div>
            </div>
        </TooltipProvider>
    )
}
