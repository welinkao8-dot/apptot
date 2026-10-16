import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Eye, EyeOff, CircleAlert, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

/* Os erros do Supabase chegam em inglês. Traduzir aqui evita a mistura de
   línguas no ecrã e permite dizer o que fazer a seguir, em vez de nomear a
   falha. */
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

    const handleLogin = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')
        const { error: signInError } = await signIn(email, password)
        if (signInError) {
            setError(describeSignInError(signInError))
            setIsLoading(false)
        } else {
            toast.success('Sessão iniciada')
        }
    }

    return (
        <div className="login-page">
            <div className="login-card animate-fade-in">
                <div className="login-brand">
                    <span className="login-brand-mark" aria-hidden="true">TOT</span>
                    <span className="login-brand-copy">
                        <strong>Painel de operações</strong>
                        <small>Gestão de frota e corridas</small>
                    </span>
                </div>

                <div className="login-intro">
                    <h1>Entrar</h1>
                    <p>Use as credenciais de administrador para aceder à consola.</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && (
                        <p className="login-error" role="alert">
                            <CircleAlert size={18} aria-hidden="true" />
                            <span>{error}</span>
                        </p>
                    )}

                    <div className="input-field">
                        <label htmlFor="admin-email">E-mail</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" aria-hidden="true" />
                            <input
                                id="admin-email"
                                type="email"
                                name="email"
                                autoComplete="username"
                                placeholder="nome@tot.ao"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-field">
                        <label htmlFor="admin-password">Palavra-passe</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" aria-hidden="true" />
                            <input
                                id="admin-password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="login-password-toggle"
                                onClick={() => setShowPassword(current => !current)}
                                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="tot-btn tot-btn--primary tot-btn--lg tot-btn--block" disabled={isLoading}>
                        <span>{isLoading ? 'A autenticar…' : 'Entrar'}</span>
                        {!isLoading && <ArrowRight size={18} aria-hidden="true" />}
                    </button>
                </form>

                <p className="login-footer">TOT Mobility Group · Acesso restrito a administradores</p>
            </div>
        </div>
    )
}
