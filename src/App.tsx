import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { TwitterCallbackPage } from './pages/TwitterCallbackPage';
import { EmailCallbackPage } from './pages/EmailCallbackPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Helper function to validate URL
function isValidUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const urlObj = new URL(trimmed);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Check for required environment variables with validation
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawSupabaseUrl?.trim();
const supabaseAnonKey = rawSupabaseAnonKey?.trim();

const isValidSupabaseUrl = isValidUrl(supabaseUrl);
const hasValidKey = supabaseAnonKey && supabaseAnonKey.length > 0;
const hasRequiredEnv = isValidSupabaseUrl && hasValidKey;

function EnvErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-8">
      <div className="max-w-2xl rounded-lg border border-yellow-500/50 bg-yellow-950/20 p-6 text-white">
        <h1 className="mb-4 text-2xl font-bold text-yellow-400">Configuration Error</h1>
        <p className="mb-4 text-yellow-300">
          Missing required environment variables. Please configure the following in your Vercel project settings:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6 text-yellow-200">
          <li>VITE_SUPABASE_URL: {isValidSupabaseUrl ? '✓ Valid' : '✗ Invalid/Missing'} 
            {rawSupabaseUrl && !isValidSupabaseUrl && ` (Value: "${rawSupabaseUrl.substring(0, 50)}${rawSupabaseUrl.length > 50 ? '...' : ''}")`}
          </li>
          <li>VITE_SUPABASE_ANON_KEY: {hasValidKey ? '✓ Set' : '✗ Missing'}</li>
        </ul>
        {rawSupabaseUrl && !isValidSupabaseUrl && (
          <p className="mb-4 text-sm text-yellow-400">
            The URL must be a valid HTTP or HTTPS URL. Current value appears to be invalid.
          </p>
        )}
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
  // Show error page if environment variables are missing BEFORE using hooks
  if (!hasRequiredEnv) {
    return <EnvErrorPage />;
  }

  // Only call useAuth after we've confirmed env vars are present
  const { user } = useAuth();

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

