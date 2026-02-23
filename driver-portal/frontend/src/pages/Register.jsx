import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-hot-toast'
import { User, Phone, MapPin, Mail, Lock, FileText, Camera, CheckCircle } from 'lucide-react'
import './Register.css'

export default function Register() {
    const navigate = useNavigate()
    const location = useLocation()
    const { signUp, updateDocs, user, signOut, checkPhone } = useAuth()
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(1) // 1: Personals, 2: Documents, 3: Success Pending

    const [form, setForm] = useState({
        full_name: '',
        phone: location.state?.phone || '', // Captura o telefone do Login se existir
        email: '',
        address: '',
        password: '',
        bi_frente: '',
        bi_verso: '',
        carta: ''
    })

    // Sincroniza o passo se o usuário já estiver logado mas sem docs
    useEffect(() => {
        if (user && user.status === 'pending_docs' && step === 1) {
            setStep(2)
        } else if (user && user.status === 'pending') {
            setStep(3)
        }
    }, [user])

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

    const handleSubmitData = async (e) => {
        e.preventDefault()
        if (!form.phone.startsWith('9') || form.phone.length !== 9) {
            return toast.error('Telefone Inválido (9 dígitos começando com 9)')
        }

        setLoading(true)
        try {
            // Check if phone already exists before attempting registration
            const { exists } = await checkPhone(form.phone)
            if (exists) {
                setLoading(false)
                toast.error('Este número já está cadastrado. Por favor, faça login.')
                setTimeout(() => navigate('/login'), 2000)
                return
            }

            const { error } = await signUp({
                full_name: form.full_name,
                phone: form.phone,
                email: form.email,
                address: form.address,
                password: form.password
            })

            if (error) {
                toast.error(error)
            } else {
                setStep(2)
                toast.success('Dados salvos! Agora os documentos.')
            }
        } catch (error) {
            toast.error('Erro ao conectar ao servidor')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmitDocs = async (e) => {
        e.preventDefault()
        if (!form.bi_frente || !form.bi_verso || !form.carta) {
            return toast.error('Por favor, anexe todos os documentos obrigatórios.')
        }

        setLoading(true)
        console.log('Sending docs with keys:', Object.keys({
            bi_frente: form.bi_frente?.substring(0, 20) + '...',
            bi_verso: form.bi_verso?.substring(0, 20) + '...',
            carta: form.carta?.substring(0, 20) + '...'
        }));

        try {
            const { error } = await updateDocs({
                bi_frente: form.bi_frente,
                bi_verso: form.bi_verso,
                carta: form.carta
            })

            if (error) {
                toast.error(error)
            } else {
                setStep(3)
                toast.success('Documentos enviados com sucesso!')
            }
        } catch (error) {
            toast.error('Erro ao enviar documentos')
        } finally {
            setLoading(false)
        }
    }

    if (step === 3) {
        return (
            <div className="auth-container">
                <div className="auth-card success-card shadow-lg animate-fade-in">
                    <div className="success-icon-wrapper">
                        <CheckCircle size={80} color="#E91E63" />
                    </div>
                    <h2>Cadastro Concluído!</h2>
                    <p className="pending-msg">Sua conta está em **análise**. Você pode acessar o painel agora, mas algumas funções estarão limitadas até a aprovação do Admin.</p>
                    <button className="confirm-btn outline" onClick={signOut}>
                        SAIR E AGUARDAR
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="auth-card shadow-lg">
                <div className="auth-header">
                    <h1 className="logo">TOT</h1>
                    <p className="subtitle">Portal do Motorista</p>
                    <div className="step-indicator">
                        <div className={`dot ${step >= 1 ? 'active' : ''}`}></div>
                        <div className="line"></div>
                        <div className={`dot ${step >= 2 ? 'active' : ''}`}></div>
                    </div>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleSubmitData}>
                        <div className="step-content animate-slide-right">
                            <div className="input-group">
                                <User className="input-icon" size={20} />
                                <input
                                    type="text" placeholder="Nome Completo" required
                                    value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <Phone className="input-icon" size={20} />
                                <input
                                    type="tel" placeholder="Telefone (9XXXXXXXX)" required
                                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <Mail className="input-icon" size={20} />
                                <input
                                    type="email" placeholder="E-mail" required
                                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <MapPin className="input-icon" size={20} />
                                <input
                                    type="text" placeholder="Endereço de Residência" required
                                    value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password" placeholder="Sua Senha" required
                                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="confirm-btn" disabled={loading}>
                                {loading ? 'CRIANDO CONTA...' : 'PRÓXIMO'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSubmitDocs}>
                        <div className="step-content animate-slide-left">
                            <p className="doc-instruction">Olá {user?.full_name?.split(' ')[0]}, anexe seus documentos para análise:</p>

                            <div className="file-input-wrapper">
                                <label className={`file-label ${form.bi_frente ? 'uploaded' : ''}`}>
                                    <Camera size={20} />
                                    <span>{form.bi_frente ? 'B.I. FRENTE (OK)' : 'B.I. FRENTE'}</span>
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'bi_frente')} />
                                </label>

                                <label className={`file-label ${form.bi_verso ? 'uploaded' : ''}`}>
                                    <Camera size={20} />
                                    <span>{form.bi_verso ? 'B.I. VERSO (OK)' : 'B.I. VERSO'}</span>
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'bi_verso')} />
                                </label>

                                <label className={`file-label ${form.carta ? 'uploaded' : ''}`}>
                                    <FileText size={20} />
                                    <span>{form.carta ? 'CARTA DE CONDUÇÃO (OK)' : 'CARTA DE CONDUÇÃO'}</span>
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'carta')} />
                                </label>
                            </div>

                            <button type="submit" className="confirm-btn" disabled={loading}>
                                {loading ? 'ENVIANDO...' : 'FINALIZAR CADASTRO'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="auth-footer">
                    <p>Já tem uma conta? <Link to="/login">Entrar</Link></p>
                </div>
            </div>
        </div>
    )
}
