import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import History from './pages/History'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import './index.css'

function AppContent() {
    const { user } = useAuth()
    const [view, setView] = useState('dashboard') // dashboard, history

    if (!user) {
        return <Login />
    }

    if (view === 'history') {
        return <History onBack={() => setView('dashboard')} />
    }

    return <Dashboard onNavigate={(v) => setView(v)} />
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    )
}

export default App
