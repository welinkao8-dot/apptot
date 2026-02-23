import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Suspended from './pages/Suspended'
import './index.css'
import './App.css'

import History from './pages/History'

function AppContent() {
    const { user } = useAuth()

    // 1. USUÁRIO NÃO LOGADO
    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        )
    }

    // 2. USUÁRIO COM DOCS PENDENTES (Ex: acabou de criar conta)
    if (user.status === 'pending_docs') {
        return (
            <Routes>
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<Navigate to="/register" replace />} />
            </Routes>
        )
    }

    // 3. USUÁRIO SUSPENSO
    if (user.status === 'suspended') {
        return (
            <Routes>
                <Route path="/suspended" element={<Suspended />} />
                <Route path="*" element={<Navigate to="/suspended" replace />} />
            </Routes>
        )
    }

    // 4. USUÁRIO LOGADO E COM STATUS (active, pending, rejected)
    return (
        <Routes>
            {/* ROTA PROTEGIDA: SÓ ENTRA SE ESTIVER 'active' */}
            <Route
                path="/dashboard"
                element={user.status === 'active' ? <Dashboard /> : <Navigate to="/register" replace />}
            />

            <Route
                path="/history"
                element={user.status === 'active' ? <History /> : <Navigate to="/register" replace />}
            />

            {/* /register serve como tela de status para 'pending' */}
            <Route path="/register" element={<Register />} />

            {/* Redirecionamento padrão */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </AuthProvider>
    )
}
