import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, Phone, MapPin, Mail, Lock, FileText, Camera, CheckCircle, LogOut } from 'lucide-react'
import './Login.css'

export default function Login() {
    const navigate = useNavigate()
    const { checkPhone, signIn, signUp, updateDocs, user, signOut } = useAuth()

    // ESTADOS DE FLUXO
    const [step, setStep] = useState('phone') // phone, login, register_info, register_docs, pending
    const [loading, setLoading] = useState(false)

    // DADOS DO FORMULÁRIO
    const [form, setForm] = useState({
        phone: '',
        password: '',
        full_name: '',
        email: '',
        address: '',
        bi_frente: '',
        bi_verso: '',
        carta: ''
    })

    // SINCRONIZAÇÃO INICIAL BASEADA NO STATUS DO USUÁRIO
    useEffect(() => {
        if (user) {
            if (user.status === 'pending_docs') {
                setStep('register_docs')
            } else if (user.status === 'pending') {
                setStep('pending')
            } else if (user.status === 'active') {
                navigate('/dashboard')
            }
        }
    }, [user, navigate])

    // --- MANIPULADORES DE EVENTOS ---

    const handleCheckPhone = async (e) => {
        e.preventDefault()
        const phoneRegex = /^9\d{8}$/
        if (!phoneRegex.test(form.phone)) {
            return toast.error('O número deve começar com 9 e ter exatamente 9 dígitos.')
        }

        setLoading(true)
        try {
            const { exists, error } = await checkPhone(form.phone)
            setLoading(false)
            if (error) return toast.error(error)

            if (exists) {
                setStep('login')
            } else {
                toast('Bem-vindo ao TOT! Vamos criar sua conta.', { icon: '👋' })
                setStep('register_info')
            }
        } catch (err) {
            setLoading(false)
            toast.error('Erro ao conectar ao servidor')
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { driver, error } = await signIn(form.phone, form.password)
            setLoading(false)
            if (error) {
                toast.error(error)
            } else {
                toast.success('Login realizado com sucesso!')
                if (driver.status === 'active' || driver.status === 'pending') {
                    navigate('/dashboard')
                }
            }
        } catch (err) {
            setLoading(false)
            toast.error('Erro ao conectar ao servidor')
        }
    }

    const handleRegisterInfo = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await signUp({
                full_name: form.full_name,
                phone: form.phone,
                email: form.email,
                address: form.address,
                password: form.password
            })
            setLoading(false)
            if (error) {
                toast.error(error)
            } else {
                toast.success('Conta criada! Agora anexe os documentos.')
                setStep('register_docs')
            }
        } catch (err) {
            setLoading(false);
            toast.error('Erro ao registrar')
        }
    }

    const handleFileChange = (e, field) => {
        const file = e.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setForm(prev => ({ ...prev, [field]: reader.result }))
                toast.success('Documento anexado!')
            }
            reader.readAsDataURL(file)
        }
    }

    const handleUpdateDocs = async (e) => {
        e.preventDefault()
        if (!form.bi_frente || !form.bi_verso || !form.carta) {
            return toast.error('Por favor, anexe todos os documentos obrigatórios.')
        }

        setLoading(true)
        try {
            const { error } = await updateDocs({
                bi_frente: form.bi_frente,
                bi_verso: form.bi_verso,
                carta: form.carta
            })
            setLoading(false)
            if (error) {
                toast.error(error)
            } else {
                toast.success('Documentos enviados!')
                setStep('pending')
            }
        } catch (err) {
            setLoading(false);
            toast.error('Erro ao enviar documentos')
        }
    }

    // --- RENDERIZAÇÃO DA UI ---

    return (
        <div className="login-container">
            <div className={`login-card shadow-lg ${step === 'register_docs' ? 'wide-card' : ''}`}>
                <h1 className="logo-text">TOT</h1>
                <p className="subtitle">Motorista — Rapidez e Segurança</p>

                {/* PASSO 1: TELEFONE */}
                {step === 'phone' && (
                    <form onSubmit={handleCheckPhone} className="animate-fade-in">
                        <div className="input-group">
                            <label>Número de Telefone</label>
                            <div className="input-with-icon">
                                <Phone className="input-icon" size={20} />
                                <input
                                    type="tel"
                                    placeholder="9XXXXXXXX"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Verificando...' : 'Continuar'}
                        </button>
                    </form>
                )}

                {/* PASSO 2: LOGIN (SENHA) */}
                {step === 'login' && (
                    <form onSubmit={handleLogin} className="animate-fade-in">
                        <p className="info-msg">Bem-vindo de volta, digite sua senha.</p>
                        <div className="input-group">
                            <label>Sua Senha</label>
                            <div className="input-with-icon">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password"
                                    placeholder="******"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                        <button type="button" className="btn-text" onClick={() => setStep('phone')}>
                            Voltar
                        </button>
                    </form>
                )}

                {/* PASSO 3: REGISTRO (INFORMAÇÕES PESSOAIS) */}
                {step === 'register_info' && (
                    <form onSubmit={handleRegisterInfo} className="animate-fade-in">
                        <p className="info-msg">Vamos começar seu cadastro!</p>

                        <div className="input-group">
                            <div className="input-with-icon">
                                <User className="input-icon" size={20} />
                                <input
                                    type="text" placeholder="Nome Completo" required
                                    value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="input-with-icon">
                                <Mail className="input-icon" size={20} />
                                <input
                                    type="email" placeholder="E-mail" required
                                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="input-with-icon">
                                <MapPin className="input-icon" size={20} />
                                <input
                                    type="text" placeholder="Endereço de Residência" required
                                    value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="input-with-icon">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password" placeholder="Crie uma Senha" required
                                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Criando Conta...' : 'Próximo Step'}
                        </button>
                        <button type="button" className="btn-text" onClick={() => setStep('phone')}>
                            Voltar
                        </button>
                    </form>
                )}

                {/* PASSO 4: DOCUMENTOS (VERTICAL STACK) */}
                {step === 'register_docs' && (
                    <form onSubmit={handleUpdateDocs} className="animate-fade-in">
                        <p className="info-msg">Olá {user?.full_name?.split(' ')[0]}, anexe seus documentos:</p>

                        <div className="file-stack">
                            <div className="file-field-container">
                                <label className={`file-card-v2 ${form.bi_frente ? 'success' : ''}`}>
                                    <Camera size={28} className="f-icon" />
                                    <span className="f-title">B.I. FRENTE {form.bi_frente && '✓'}</span>
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'bi_frente')} />
                                </label>
                                <p className="f-hint">Tire uma foto nítida da frente do seu B.I.</p>
                            </div>

                            <div className="file-field-container">
                                <label className={`file-card-v2 ${form.bi_verso ? 'success' : ''}`}>
                                    <Camera size={28} className="f-icon" />
                                    <span className="f-title">B.I. VERSO {form.bi_verso && '✓'}</span>
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'bi_verso')} />
                                </label>
                                <p className="f-hint">Certifique-se que a data de validade esteja visível.</p>
                            </div>

                            <div className="file-field-container">
                                <label className={`file-card-v2 ${form.carta ? 'success' : ''}`}>
                                    <FileText size={28} className="f-icon" />
                                    <span className="f-title">CARTA CONDUÇÃO {form.carta && '✓'}</span>
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'carta')} />
                                </label>
                                <p className="f-hint">Anexe a foto da sua carta de condução válida.</p>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" style={{ marginTop: '25px' }} disabled={loading}>
                            {loading ? 'Enviando...' : 'Finalizar Cadastro'}
                        </button>
                    </form>
                )}

                {/* PASSO 5: PENDENTE / SUCESSO */}
                {step === 'pending' && (
                    <div className="success-view animate-fade-in">
                        <CheckCircle size={80} className="success-icon" />
                        <h2>Conta em Análise</h2>
                        <p>Recebemos seus documentos. Nossa equipe irá validar em breve.</p>

                        <button className="btn-text" onClick={() => {
                            signOut();
                            setStep('phone');
                        }}>
                            <LogOut size={16} style={{ marginRight: '5px' }} /> SAIR E AGUARDAR
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
