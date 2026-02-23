import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import './Login.css'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { signIn } = useAuth()

    const handleLogin = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        const { error } = await signIn(email, password)
        if (error) {
            toast.error(error)
            setIsLoading(false)
        } else {
            toast.success('Acesso autorizado')
        }
    }

    return (
        <div className="login-page">
            <div className="login-visual-section">
                <div className="visual-overlay"></div>
                <div className="visual-content">
                    <div className="brand-badge">
                        <ShieldCheck size={24} />
                        <span>TOT Enterprise</span>
                    </div>
                    <h1>Central de Inteligência Operacional</h1>
                    <p>Gestão estratégica em tempo real para o futuro da mobilidade urbana.</p>
                </div>
            </div>

            <div className="login-form-section">
                <div className="login-card-v2 animate-slide-up">
                    <div className="form-header">
                        <h2>Bem-vindo, Administrador</h2>
                        <p>Inicie sessão para aceder ao painel de controlo.</p>
                    </div>

                    <form onSubmit={handleLogin} className="elegant-form">
                        <div className="input-field">
                            <label>E-mail Corporativo</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    placeholder="exemplo@tot.ao"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-field">
                            <label>Palavra-passe</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`btn-elegant ${isLoading ? 'loading' : ''}`}
                            disabled={isLoading}
                        >
                            <span>{isLoading ? 'A autenticar...' : 'Entrar no Sistema'}</span>
                            {!isLoading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="form-footer">
                        <p>© 2026 TOT Mobility Group. Todos os direitos reservados.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
