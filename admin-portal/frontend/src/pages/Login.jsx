import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const describeSignInError = raw => {
    const value = String(raw || '').toLowerCase()
    if (value.includes('invalid') || value.includes('credential')) {
        return 'E-mail ou palavra-passe incorretos. Verifique os dados e tente novamente.'
    }
    if (value.includes('confirm') || value.includes('verif')) {
        return 'Esta conta ainda não está confirmada. Verifique o e-mail de confirmação.'
    }
    if (value.includes('rate') || value.includes('too many')) {
        return 'Demasiadas tentativas. Aguarde um minuto antes de tentar novamente.'
    }
    return 'Não foi possível iniciar sessão. Tente novamente.'
}

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { signIn } = useAuth()

    const handleLogin = async e => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        const { error: signInError } = await signIn(email, password)
        if (signInError) {
            setError(describeSignInError(signInError))
            setIsLoading(false)
        } else {
            toast.success('Sessão iniciada com sucesso!')
        }
    }

    return (
        <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/80">
                {/* Brand & Logo Header */}
                <div className="flex flex-col items-center text-center mb-8">
                    <img
                        src="/logo.png"
                        alt="TOT Moto Táxi"
                        className="w-16 h-16 rounded-full object-contain shadow-sm mb-3 ring-4 ring-pink-50"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-pink-50 text-[#E91E63] border border-pink-200/60 uppercase tracking-wider">
                            Admin Portal
                        </span>
                    </div>
                    <h1 className="text-xl font-semibold text-slate-900 mt-4">Bem-vindo à Consola</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Acesso exclusivo para gestão de frota, finanças e operações
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2.5">
                            <AlertCircle size={16} className="shrink-0 text-rose-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700" htmlFor="admin-email">
                            E-mail de Administrador
                        </label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                id="admin-email"
                                type="email"
                                autoComplete="username"
                                placeholder="admin@tot.ao"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="pl-10 h-11 rounded-2xl border-slate-200/80 focus-visible:ring-[#E91E63] text-xs bg-slate-50/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700" htmlFor="admin-password">
                            Palavra-passe
                        </label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                id="admin-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="pl-10 pr-10 h-11 rounded-2xl border-slate-200/80 focus-visible:ring-[#E91E63] text-xs bg-slate-50/50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(p => !p)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-11 rounded-full bg-[#E91E63] hover:bg-[#D81B60] text-white font-semibold text-xs shadow-md shadow-pink-500/25 transition-all mt-6 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>A autenticar...</span>
                            </>
                        ) : (
                            <>
                                <span>Entrar na Consola</span>
                                <ArrowRight size={15} />
                            </>
                        )}
                    </Button>
                </form>

                <div className="text-center mt-6 text-[11px] text-slate-400">
                    TOT Moto Táxi Angola • Todos os direitos reservados
                </div>
            </div>
        </div>
    )
}
