import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './Login.css'

export default function Login() {
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [step, setStep] = useState('phone') // 'phone', 'login', 'register'
    const { checkPhone, signIn, register } = useAuth()
    const [loading, setLoading] = useState(false)

    const handleCheckPhone = async (e) => {
        e.preventDefault()

        // Validação: Começa com 9 e tem 9 dígitos
        const phoneRegex = /^9\d{8}$/
        if (!phoneRegex.test(phone)) {
            return toast.error('O número deve começar com 9 e ter exatamente 9 dígitos.')
        }

        setLoading(true)
        const { exists, error } = await checkPhone(phone)
        setLoading(false)
        if (error) return toast.error(error)

        if (exists) {
            toast.success('Telefone verificado! Por favor, entre com sua senha.')
            setStep('login')
        } else {
            toast('Bem-vindo ao TOT! Vamos criar sua conta.', { icon: '👋' })
            setStep('register')
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { error } = await signIn(phone, password)
        setLoading(false)
        if (error) {
            toast.error(error)
        } else {
            toast.success('Login realizado com sucesso!')
        }
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        const { error } = await register(phone, fullName, password)
        setLoading(false)
        if (error) {
            toast.error(error)
        } else {
            toast.success('Conta criada com sucesso! Bem-vindo(a).')
        }
    }

    return (
        <div className="login-container">
            <div className="login-card shadow-lg">
                <h1 className="logo-text">TOT</h1>
                <p className="subtitle">Rapidez, Qualidade e Segurança</p>

                {step === 'phone' && (
                    <form onSubmit={handleCheckPhone}>
                        <div className="input-group">
                            <label>Número de Telefone</label>
                            <input
                                type="tel"
                                placeholder="9XXXXXXXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Verificando...' : 'Continuar'}
                        </button>
                    </form>
                )}

                {step === 'login' && (
                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <label>Sua Senha</label>
                            <input
                                type="password"
                                placeholder="******"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                        <button type="button" className="btn-text" onClick={() => setStep('phone')}>
                            Voltar
                        </button>
                    </form>
                )}

                {step === 'register' && (
                    <form onSubmit={handleRegister}>
                        <p className="info-msg">Parece que você é novo por aqui! Vamos criar sua conta.</p>
                        <div className="input-group">
                            <label>Nome Completo</label>
                            <input
                                type="text"
                                placeholder="João Silva"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Crie uma Senha</label>
                            <input
                                type="password"
                                placeholder="******"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Criando conta...' : 'Criar Conta'}
                        </button>
                        <button type="button" className="btn-text" onClick={() => setStep('phone')}>
                            Voltar
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
