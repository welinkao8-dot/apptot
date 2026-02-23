import { useEffect, useRef } from 'react'
import { CheckCircle, LogOut, Ban } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import './Login.css'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3004'

export default function Suspended() {
    const { signOut, user } = useAuth()
    const navigate = useNavigate()
    const socketRef = useRef(null)

    useEffect(() => {
        if (user) {
            // Connect to WebSocket to listen for account reactivation
            socketRef.current = io(SOCKET_URL)

            socketRef.current.on('connect', () => {
                console.log('Suspended screen: Socket connected')
                socketRef.current.emit('join', { userId: user.id, role: 'driver' })
            })

            // Listen for account activation
            socketRef.current.on('account_activated', (data) => {
                console.log('✅ Account reactivated:', data)
                toast.success(data.message || 'Sua conta foi reativada!', { duration: 5000 })

                // Update user status in localStorage
                const updatedUser = { ...user, status: 'active' }
                localStorage.setItem('tot_driver_user', JSON.stringify(updatedUser))

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    window.location.href = '/dashboard'
                }, 2000)
            })

            return () => {
                if (socketRef.current) socketRef.current.disconnect()
            }
        }
    }, [user])

    const handleSignOut = () => {
        signOut()
        navigate('/login')
    }

    return (
        <div className="login-container">
            <div className="login-card shadow-lg">
                <h1 className="logo-text">TOT</h1>
                <p className="subtitle">Motorista — Rapidez e Segurança</p>

                <div className="success-view animate-fade-in">
                    <Ban size={80} className="suspended-icon" style={{ color: '#ef4444' }} />
                    <h2>Conta Suspensa</h2>
                    <p>Sua conta foi temporariamente suspensa pelo administrador.</p>
                    <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#64748b' }}>
                        Entre em contato com o suporte para mais informações.
                    </p>

                    <button className="btn-text" onClick={handleSignOut} style={{ marginTop: '30px' }}>
                        <LogOut size={16} style={{ marginRight: '5px' }} /> SAIR
                    </button>
                </div>
            </div>
        </div>
    )
}
