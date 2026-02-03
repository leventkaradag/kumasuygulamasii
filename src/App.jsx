import { Routes, Route, Navigate } from "react-router-dom";

import Depo from "./pages_DISABLED/Depo.js";
import Desenler from "./pages_DISABLED/Desenler.js";
import Dokuma from "./pages_DISABLED/Dokuma.js";
import Boyahane from "./pages_DISABLED/Boyahane.js";
import Raporlar from "./pages_DISABLED/Raporlar.js";
import Ayarlar from "./pages_DISABLED/Ayarlar.js";

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
