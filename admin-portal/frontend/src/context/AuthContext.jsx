import { createContext, useContext, useEffect, useState } from 'react'
import adminApi from '../services/adminApi'
import {
    ADMIN_AUTH_EXPIRED_EVENT,
    ADMIN_AUTH_REFRESHED_EVENT,
    clearAdminSession,
    restoreAdminSession,
    setAdminAccessToken,
} from '../services/adminAuthSession'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const handleAuthExpired = () => setUser(null)
        const handleSessionRefreshed = event => setUser(event.detail?.user || null)
        window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired)
        window.addEventListener(ADMIN_AUTH_REFRESHED_EVENT, handleSessionRefreshed)

        let active = true
        restoreAdminSession(adminApi)
            .then(restoredUser => { if (active) setUser(restoredUser) })
            .catch(() => { if (active) clearAdminSession() })
            .finally(() => { if (active) setLoading(false) })

        return () => {
            active = false
            window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired)
            window.removeEventListener(ADMIN_AUTH_REFRESHED_EVENT, handleSessionRefreshed)
        }
    }, [])

    const value = {
        signIn: async (email, password) => {
            try {
                const response = await adminApi.post('/admin/auth/login', { email, password })
                const { user, token } = response.data
                if (!user || typeof token !== 'string' || !token) {
                    throw new Error('Resposta de autenticação inválida.')
                }

                setAdminAccessToken(token)
                setUser(user)

                return { data: { user }, error: null }
            } catch (err) {
                return { error: err.adminApiError?.message || err.response?.data?.message || 'Email ou senha incorretos' }
            }
        },
        signOut: async () => {
            try {
                await adminApi.post('/admin/auth/logout')
                return { error: null }
            } catch (error) {
                return { error: error.adminApiError?.message || 'Não foi possível confirmar o encerramento da sessão no servidor.' }
            } finally {
                clearAdminSession()
                setUser(null)
            }
        },
        user,
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext)
}
