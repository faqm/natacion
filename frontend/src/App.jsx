import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { useContext } from 'react';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LiveEvents from './pages/LiveEvents';

function Navigation() {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Natación
              </span>
              <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                Live
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">Eventos</Link>
            {user ? (
              <>
                {['ADMIN', 'COLABORADOR'].includes(user.rol) && (
                  <Link to="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">Dashboard</Link>
                )}
                <button onClick={logout} className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 font-medium">
                  Salir
                </button>
              </>
            ) : (
              <Link to="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 font-sans text-gray-900 dark:text-gray-100">
            <Navigation />
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<LiveEvents />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
              </Routes>
            </main>
            <Toaster position="top-right" />
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
