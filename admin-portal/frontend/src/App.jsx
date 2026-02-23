import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { Toaster } from 'react-hot-toast'
import './index.css'

function AppContent() {
    const { user } = useAuth()

    if (!user) return <Login />

    return <Dashboard />
}

function App() {
    return (
        <AuthProvider>
            <Toaster position="top-right" />
            <AppContent />
        </AuthProvider>
    )
}

export default App
