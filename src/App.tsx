import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SchedulePage } from './pages/SchedulePage'
import { SharePage } from './pages/SharePage'
import { AdminPage } from './pages/AdminPage'
import { useDarkMode } from './hooks/useDarkMode'

export default function App() {
  const { isDark, toggle } = useDarkMode()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SchedulePage isDark={isDark} onToggleDark={toggle} />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  )
}
