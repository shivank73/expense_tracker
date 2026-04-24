import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext'; // Assuming your context file is named SettingsContext.js/jsx

// --- PAGE IMPORTS (Matching your exact pages folder) ---
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Budgets from './pages/Budgets';
import Autopilot from './pages/Autopilot';
import PortfolioAssets from './pages/PortfolioAssets';
import PortfolioHoldings from './pages/PortfolioHoldings';
import Insights from './pages/Insights';
import PortfolioGoals from './pages/PortfolioGoals';
import Settings from './pages/Settings';

// --- INLINE SECURITY WRAPPER ---
// This acts as the bouncer. It intercepts the user before they load a page.
const ProtectedRoute = () => {
  const token = localStorage.getItem('token');
  
  // If they don't have a token, boot them back to the login screen
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If they have a token, render the requested page
  return <Outlet />;
};

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          {/* 1. THE PUBLIC ROUTE */}
          <Route path="/login" element={<Login />} />

          {/* 2. THE PROTECTED ROUTES (Locked behind the bouncer) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/autopilot" element={<Autopilot />} />
            <Route path="/portfolio" element={<PortfolioAssets />} />
            <Route path="/holdings" element={<PortfolioHoldings />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/goals" element={<PortfolioGoals />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* 3. THE FALLBACK CATCH-ALL */}
          {/* Any random URL types will hit this and redirect to Dashboard (which then checks for a token) */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}