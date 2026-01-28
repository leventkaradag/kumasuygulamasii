import { Routes, Route, Navigate } from "react-router-dom";

import Depo from "./pages/Depo.tsx";
import Desenler from "./pages/Desenler.tsx";
import Dokuma from "./pages/Dokuma.tsx";
import Boyahane from "./pages/Boyahane.tsx";
import Raporlar from "./pages/Raporlar.tsx";
import Ayarlar from "./pages/Ayarlar.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Panel */}
      <Route path="/dashboard" element={<Depo />} />
      <Route path="/depo" element={<Depo />} />
      <Route path="/desenler" element={<Desenler />} />
      <Route path="/dokuma" element={<Dokuma />} />
      <Route path="/boyahane" element={<Boyahane />} />
      <Route path="/raporlar" element={<Raporlar />} />
      <Route path="/ayarlar" element={<Ayarlar />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
