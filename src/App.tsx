import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TenantProvider, useTenant } from './contexts/TenantContext'
import { useAuth } from './hooks/useAuth'
import { SchedulePage } from './pages/SchedulePage'
import { SharePage } from './pages/SharePage'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage } from './pages/DashboardPage'
import { TenantSelectPage } from './pages/TenantSelectPage'
import { PendingPage } from './pages/PendingPage'
import { SuperAdminPage } from './pages/SuperAdminPage'
import { useDarkMode } from './hooks/useDarkMode'

function AppRoutes() {
  useDarkMode()
  const { profile, loading: authLoading } = useAuth()
  const { tenant, tenantRole, memberships, loading: tenantLoading, tenantSelectedByUser } = useTenant()

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-[var(--color-text-secondary)] text-sm">로딩 중...</div>
      </div>
    )
  }

  // 승인된 조직이 없으면 PendingPage (슈퍼관리자 제외)
  // memberships는 TenantContext에서 이미 is_approved=true만 필터됨
  if (profile && memberships.length === 0 && !profile.is_super_admin) {
    return (
      <Routes>
        <Route path="/share" element={<SharePage />} />
        <Route path="/superadmin" element={<SuperAdminPage />} />
        <Route path="*" element={<PendingPage />} />
      </Routes>
    )
  }

  // Logged-in user with multiple memberships and no tenant selected yet → org picker
  // Super admins can still navigate directly to /superadmin or /admin
  if (profile && memberships.length > 1 && !tenant && !profile.is_super_admin) {
    return (
      <Routes>
        <Route path="/share" element={<SharePage />} />
        <Route path="/superadmin" element={<SuperAdminPage />} />
        <Route path="*" element={<TenantSelectPage />} />
      </Routes>
    )
  }

  // Super admin who hasn't explicitly selected a tenant → org picker (shows all tenants)
  if (profile?.is_super_admin && !tenantSelectedByUser) {
    return (
      <Routes>
        <Route path="/share" element={<SharePage />} />
        <Route path="/superadmin" element={<SuperAdminPage />} />
        <Route path="*" element={<TenantSelectPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={
        <Navigate to="/schedule" replace />
      } />
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/dashboard" element={
        tenantRole === 'admin' || profile?.is_super_admin
          ? <DashboardPage />
          : <Navigate to="/" replace />
      } />
      <Route path="/share" element={<SharePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/select-org" element={<TenantSelectPage />} />
      <Route path="/pending" element={<PendingPage />} />
      <Route path="/superadmin" element={
        profile?.is_super_admin ? <SuperAdminPage /> : <Navigate to="/" replace />
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <AppRoutes />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
