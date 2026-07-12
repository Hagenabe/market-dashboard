import { HashRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { IndicatorDetail } from './pages/IndicatorDetail'
import { PortfolioPage } from './pages/PortfolioPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/indicator/:id" element={<IndicatorDetail />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
      </Routes>
    </HashRouter>
  )
}
