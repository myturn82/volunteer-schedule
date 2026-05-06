import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SchedulePage } from './pages/SchedulePage'
import { SharePage } from './pages/SharePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SchedulePage />} />
        <Route path="/share" element={<SharePage />} />
      </Routes>
    </BrowserRouter>
  )
}
