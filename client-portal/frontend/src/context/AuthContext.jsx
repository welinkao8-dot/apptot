import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext({})

// API URL - Aponta agora para o backend exclusivo do cliente (3001 - NestJS)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const storedUser = localStorage.getItem('tot_user')
        const storedToken = localStorage.getItem('tot_token')

        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser))
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        }
        setLoading(false)
    }, [])

    const value = {
        checkPhone: async (phone) => {
            try {
                const response = await axios.post(`${API_URL}/auth/check-phone`, { phone })
                return { exists: response.data.exists, error: null }
            } catch (err) {
                return { error: 'Erro ao verificar telefone' }
            }
        },
        register: async (phone, fullName, password) => {
            try {
                const response = await axios.post(`${API_URL}/auth/register`, { phone, fullName, password })
                const { user, token } = response.data
                setUser(user)
                localStorage.setItem('tot_user', JSON.stringify(user))
                localStorage.setItem('tot_token', token)
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
                return { data: { user }, error: null }
            } catch (err) {
                return { error: err.response?.data?.error || 'Erro ao criar conta' }
            }
        },
        signIn: async (phone, password) => {
            try {
                const response = await axios.post(`${API_URL}/auth/login`, { phone, password })
                const { user, token } = response.data
                setUser(user)
                localStorage.setItem('tot_user', JSON.stringify(user))
                localStorage.setItem('tot_token', token)
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
                return { data: { user }, error: null }
            } catch (err) {
                return { error: err.response?.data?.error || 'Erro ao fazer login' }
            }
        },
        signOut: () => {
            setUser(null)
            localStorage.removeItem('tot_user')
            localStorage.removeItem('tot_token')
            delete axios.defaults.headers.common['Authorization']
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
