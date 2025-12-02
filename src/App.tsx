import { Routes, Route } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { TwitterCallbackPage } from './pages/TwitterCallbackPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/twitter/callback" element={<TwitterCallbackPage />} />
    </Routes>
  );
}

export default App;

