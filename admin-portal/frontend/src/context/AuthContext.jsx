import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext({})

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
        signIn: async (email, password) => {
            try {
                const response = await axios.post(`${API_URL}/admin/auth/login`, { email, password })
                const { user, token } = response.data

                setUser(user)
                localStorage.setItem('tot_user', JSON.stringify(user))
                localStorage.setItem('tot_token', token)
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

                return { data: { user }, error: null }
            } catch (err) {
                return { error: err.response?.data?.message || 'Email ou senha incorretos' }
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
