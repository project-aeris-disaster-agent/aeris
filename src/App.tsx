import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { TwitterCallbackPage } from './pages/TwitterCallbackPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to="/home" replace /> : <AuthPage />} 
      />
      <Route path="/auth" element={<AuthPage />} />
      <Route 
        path="/home" 
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } 
      />
      <Route path="/auth/twitter/callback" element={<TwitterCallbackPage />} />
    </Routes>
  );
}

export default App;

