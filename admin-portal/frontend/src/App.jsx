import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'react-hot-toast'
import AdminLayout from './components/layout/AdminLayout'
import DashboardOverview from './pages/DashboardOverview'
import Drivers from './pages/Drivers'
import Clients from './pages/Clients'
import Pricing from './pages/Pricing'
import Trips from './pages/Trips'
import AuditLogs from './pages/AuditLogs'
import Invoices from './pages/Invoices'
import Configs from './pages/Configs'
import LiveOps from './pages/LiveOps'
import Payments from './pages/Payments'
import Login from './pages/Login'

function ProtectedLayout() {
    const { user } = useAuth()
    if (!user) return <Navigate to="/login" replace />
    return <AdminLayout />
}

function PublicRoute() {
    const { user } = useAuth()
    if (user) return <Navigate to="/" replace />
    return <Login />
}

export default function App() {
    return (
        <AuthProvider>
            <Toaster position="top-right" toastOptions={{ className: 'tot-toast' }} />
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<PublicRoute />} />
                    <Route element={<ProtectedLayout />}>
                        <Route path="/" element={<DashboardOverview />} />
                        <Route path="/dashboard" element={<Navigate to="/" replace />} />
                        <Route path="/liveops" element={<LiveOps />} />
                        <Route path="/drivers" element={<Drivers />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/trips" element={<Trips />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/payments" element={<Payments />} />
                        <Route path="/audit-logs" element={<AuditLogs />} />
                        <Route path="/configs" element={<Configs />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}
