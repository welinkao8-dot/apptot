import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext({})

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004'

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const storedUser = localStorage.getItem('tot_driver_user')
        const storedToken = localStorage.getItem('tot_driver_token')

        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser))
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        }
        setLoading(false)
    }, [])

    const checkPhone = async (phone) => {
        try {
            const response = await axios.post(`${API_URL}/auth/check-phone`, { phone })
            return { exists: response.data.exists, error: null }
        } catch (err) {
            return { exists: false, error: err.response?.data?.error || 'Erro ao verificar telefone' }
        }
    }

    const signIn = async (phone, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, { phone, password })
            const { driver, token } = response.data

            setUser(driver)
            localStorage.setItem('tot_driver_user', JSON.stringify(driver))
            localStorage.setItem('tot_driver_token', token)
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

            return { driver, error: null }
        } catch (err) {
            return { error: err.response?.data?.error || 'Credenciais inválidas' }
        }
    }

    const signUp = async (driverData) => {
        try {
            const response = await axios.post(`${API_URL}/auth/register`, driverData)
            const { driver, token } = response.data

            setUser(driver)
            localStorage.setItem('tot_driver_user', JSON.stringify(driver))
            localStorage.setItem('tot_driver_token', token)
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

            return { driver, error: null }
        } catch (err) {
            return { error: err.response?.data?.error || 'Erro ao realizar cadastro' }
        }
    }

    const updateDocs = async (docData) => {
        try {
            const response = await axios.post(`${API_URL}/auth/update-docs`, { ...docData, driverId: user.id })
            const updatedUser = { ...user, status: 'pending', ...docData }
            setUser(updatedUser)
            localStorage.setItem('tot_driver_user', JSON.stringify(updatedUser))
            return { error: null }
        } catch (err) {
            return { error: err.response?.data?.error || 'Erro ao enviar documentos' }
        }
    }

    const signOut = () => {
        setUser(null)
        localStorage.removeItem('tot_driver_user')
        localStorage.removeItem('tot_driver_token')
        delete axios.defaults.headers.common['Authorization']
    }

    const value = {
        user,
        loading,
        checkPhone,
        signIn,
        signUp,
        updateDocs,
        signOut
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
