import { createContext, useContext, useEffect, useState } from 'react'
import adminApi from '../services/adminApi'
import { ADMIN_AUTH_EXPIRED_EVENT, clearAdminSession, readStoredAdminUser } from '../services/adminAuthSession'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const handleAuthExpired = () => setUser(null)
        window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired)

        try {
            const storage = window.localStorage
            const storedUser = readStoredAdminUser(storage)
            const storedToken = storage.getItem('tot_token')
            if (storedUser && storedToken) {
                setUser(storedUser)
            } else {
                clearAdminSession(storage, null)
            }
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }

        return () => window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired)
    }, [])

    const value = {
        signIn: async (email, password) => {
            try {
                const response = await adminApi.post('/admin/auth/login', { email, password })
                const { user, token } = response.data

                setUser(user)
                localStorage.setItem('tot_user', JSON.stringify(user))
                localStorage.setItem('tot_token', token)

                return { data: { user }, error: null }
            } catch (err) {
                return { error: err.response?.data?.message || 'Email ou senha incorretos' }
            }
        },
        signOut: () => {
            setUser(null)
            clearAdminSession()
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
