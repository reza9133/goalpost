import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { AuditPage } from './pages/Audit';
import { HowPage } from './pages/How';
import { LedgerPage } from './pages/Ledger';
import { NotFoundPage } from './pages/NotFound';
import { PledgePage } from './pages/Pledge';
import { RegisterPage } from './pages/Register';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LedgerPage />} />
        <Route path="new" element={<RegisterPage />} />
        <Route path="pledges/:pledgeId" element={<PledgePage />} />
        <Route path="audits/:auditId" element={<AuditPage />} />
        <Route path="how" element={<HowPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
