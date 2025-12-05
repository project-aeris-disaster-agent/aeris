import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { TwitterCallbackPage } from './pages/TwitterCallbackPage';
import { EmailCallbackPage } from './pages/EmailCallbackPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Check for required environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasRequiredEnv = supabaseUrl && supabaseAnonKey;

function EnvErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-8">
      <div className="max-w-2xl rounded-lg border border-yellow-500/50 bg-yellow-950/20 p-6 text-white">
        <h1 className="mb-4 text-2xl font-bold text-yellow-400">Configuration Error</h1>
        <p className="mb-4 text-yellow-300">
          Missing required environment variables. Please configure the following in your Vercel project settings:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 text-yellow-200">
          <li>VITE_SUPABASE_URL: {supabaseUrl ? '✓ Set' : '✗ Missing'}</li>
          <li>VITE_SUPABASE_ANON_KEY: {supabaseAnonKey ? '✓ Set' : '✗ Missing'}</li>
        </ul>
        <p className="mb-4 text-sm text-yellow-400">
          Go to: Vercel Dashboard → Project Settings → Environment Variables
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
        >
          Reload After Configuring
        </button>
      </div>
    </div>
  );
}

function App() {
  const { user } = useAuth();

  // Show error page if environment variables are missing
  if (!hasRequiredEnv) {
    return <EnvErrorPage />;
  }

  return (
    <NotificationProvider>
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
        <Route path="/auth/callback" element={<EmailCallbackPage />} />
      </Routes>
    </NotificationProvider>
  );
}

export default App;

