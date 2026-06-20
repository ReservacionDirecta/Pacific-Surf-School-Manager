/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  Package as PackageIcon, 
  Calendar, 
  Wallet, 
  RefreshCw, 
  Upload, 
  LogOut, 
  Menu, 
  X,
  Waves,
  Lock,
  Mail,
  User as UserIcon,
  ArrowLeft,
  ClipboardList,
  Settings,
  ChevronDown
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Packages from './components/Packages';
import Instructors from './components/Instructors';
import Classes from './components/Classes';
import Payments from './components/Payments';
import ImportStudents from './components/ImportStudents';
import GoogleSheetsSync from './components/GoogleSheetsSync';
import EquipmentManager from './components/Equipment';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [viewHistory, setViewHistory] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navigateTo = useCallback((next: string) => {
    setViewHistory(prev => [view, ...prev]);
    setView(next);
  }, [view]);

  const goBack = useCallback(() => {
    if (viewHistory.length > 0) {
      const [prev, ...rest] = viewHistory;
      setView(prev);
      setViewHistory(rest);
    }
  }, [viewHistory]);

  useEffect(() => {
    const savedUser = localStorage.getItem('surf_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: email.split('@')[0] })
      });
      
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('surf_user', JSON.stringify(data));
      } else {
        setAuthError(data.error || 'Error de autenticación');
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError("Error de conexión con el servidor.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setViewHistory([]);
    localStorage.removeItem('surf_user');
  };

  // Sidebar navigation menu items with nested sub-items
  const menuItems = [
    { id: 'dashboard', name: 'Panel Principal', icon: LayoutDashboard },
    { id: 'students', name: 'Alumnos', icon: Users },
    { id: 'instructors', name: 'Instructores', icon: UserCheck },
    { id: 'packages', name: 'Planes', icon: PackageIcon },
    { id: 'classes', name: 'Clases', icon: Calendar },
    { id: 'payments', name: 'Cobranza', icon: Wallet },
    { id: 'equipment', name: 'Equipamiento', icon: ClipboardList },
    {
      id: 'config',
      name: 'Configuración',
      icon: Settings,
      subItems: [
        { id: 'sheets', name: 'Sincronizar', icon: RefreshCw },
        { id: 'import', name: 'Importar', icon: Upload },
      ]
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-100 border-t-cyan-600"></div>
          <Waves className="absolute w-6 h-6 text-cyan-600" />
        </div>
        <p className="mt-4 text-sm font-semibold font-display text-slate-500 tracking-wider">Cargando Pacific Surf...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950 p-4 relative overflow-hidden font-sans">
        {/* Artistic wave background elements using absolute positioning and soft glow effects */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[120%] rounded-full bg-blue-500 blur-[150px]"></div>
          <div className="absolute -bottom-[45%] -right-[10%] w-[60%] h-[100%] rounded-full bg-cyan-400 blur-[120px]"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-slate-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-800 max-w-md w-full relative z-10"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-3 rounded-xl text-white shadow-lg shadow-cyan-500/20 mb-3 hover:scale-105 transition-transform duration-300">
              <Waves className="w-8 h-8 md:animate-bounce" />
            </div>
            <h1 className="text-3.5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent font-display">
              Pacific Surf
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">School Management Manager</p>
          </div>
          
          <form onSubmit={handleEmailAuth} className="space-y-5 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Correo Electrónico</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  required 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="block w-full rounded-lg bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-600 outline-none transition" 
                  placeholder="admin@pacificsurf.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Contraseña</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  required 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="block w-full rounded-lg bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-600 outline-none transition" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-300 text-xs text-center"
              >
                ⚠️ {authError}
              </motion.div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white py-3 rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/10 cursor-pointer active:scale-98 transition duration-200 mt-2"
            >
              {isRegistering ? 'Registrarse en la Escuela' : 'Ingresar al Panel'}
            </button>

            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-xs text-cyan-400 hover:text-cyan-300 transition-colors text-center block mt-3 font-semibold underline underline-offset-4"
            >
              {isRegistering ? '¿Ya tienes una cuenta? Iniciar Sesión' : '¿No tienes cuenta de acceso? Regístrate'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col">
      {/* FIXED TOP NAVBAR — minimal: logo + user controls only */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-slate-900 text-white border-b border-slate-800 shadow-md flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {view !== 'dashboard' && (
            <button onClick={goBack} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer" title="Volver">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => { setView('dashboard'); setViewHistory([]); }} className="flex items-center gap-2.5 cursor-pointer">
            <div className="bg-cyan-500 p-1.5 rounded text-white">
              <Waves className="w-4.5 h-4.5" />
            </div>
            <span className="font-extrabold tracking-tight text-white font-display text-base hidden sm:inline">Pacific Surf</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 text-xs text-slate-400">
            <UserIcon className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px] font-semibold text-slate-300">{user.email.split('@')[0]}</span>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer transition-colors" title="Cerrar sesión">
            <LogOut className="w-4.5 h-4.5" />
          </button>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* SIDEBAR FOR DESKTOP (left rail, below top navbar) */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-16 bottom-0 w-64 bg-slate-900 text-slate-300 border-r border-slate-800 z-30">
        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            if (item.subItems) {
              const isExpanded = expandedMenus[item.id];
              const isChildActive = item.subItems.some(s => view === s.id);
              return (
                <div key={item.id}>
                  <button onClick={() => toggleMenu(item.id)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer tracking-wide transition-all duration-200 ${
                      isChildActive
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-900/25 border-l-4 border-cyan-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-transform ${isChildActive ? 'scale-110' : ''}`} />
                    {item.name}
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-700 pl-3">
                      {item.subItems.map(sub => {
                        const SubIcon = sub.icon;
                        const subActive = view === sub.id;
                        return (
                          <button key={sub.id} onClick={() => navigateTo(sub.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer tracking-wide transition-all duration-200 ${
                              subActive
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-900/25'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <SubIcon className="w-4 h-4 shrink-0" />
                            {sub.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer tracking-wide transition-all duration-200 ${
                  active 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-900/25 border-l-4 border-cyan-400' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform ${active ? 'scale-110' : ''}`} />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 p-2 border border-slate-700 shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-200 truncate">{user.displayName || user.email.split('@')[0]}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black z-40 lg:hidden" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed inset-y-0 left-0 w-64 bg-slate-950 text-slate-300 z-50 flex flex-col lg:hidden shadow-2xl border-r border-slate-900">
              <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                <span className="font-extrabold tracking-normal text-white text-base flex items-center gap-2">
                  <Waves className="w-5 h-5 text-cyan-400" /> Pacific Surf
                </span>
                <button onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-850 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {menuItems.map(item => {
                  const Icon = item.icon;
                  if (item.subItems) {
                    const isExpanded = expandedMenus[item.id];
                    const isChildActive = item.subItems.some(s => view === s.id);
                    return (
                      <div key={item.id}>
                        <button onClick={() => toggleMenu(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                            isChildActive ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4.5 h-4.5" />
                          {item.name}
                          <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-800 pl-3">
                            {item.subItems.map(sub => {
                              const SubIcon = sub.icon;
                              const subActive = view === sub.id;
                              return (
                                <button key={sub.id} onClick={() => { navigateTo(sub.id); setSidebarOpen(false); }}
                                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
                                    subActive ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                                  }`}
                                >
                                  <SubIcon className="w-4 h-4" />
                                  {sub.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  const active = view === item.id;
                  return (
                    <button key={item.id} onClick={() => { navigateTo(item.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                        active ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-900 bg-slate-900/60 text-xs">
                <div className="flex items-center justify-between">
                  <div className="truncate max-w-[140px]">
                    <p className="font-bold text-slate-200 truncate">{user.displayName || user.email.split('@')[0]}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
                  </div>
                  <button onClick={() => { handleLogout(); setSidebarOpen(false); }}
                    className="px-2.5 py-1.5 bg-red-950/40 border border-red-900/40 text-red-400 hover:bg-red-900 hover:text-white rounded-md text-[10px] font-bold"
                  >Salir</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN DISPLAY VIEWPORT */}
      <div className="flex-1 flex lg:pl-64 pt-16">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={view}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -7 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {view === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
                {view === 'students' && <Students onNavigate={navigateTo} />}
                {view === 'instructors' && <Instructors />}
                {view === 'packages' && <Packages />}
                {view === 'classes' && <Classes onNavigate={navigateTo} />}
                {view === 'payments' && <Payments onNavigate={navigateTo} />}
                {view === 'sheets' && <GoogleSheetsSync />}
                {view === 'import' && <ImportStudents />}
                {view === 'equipment' && <EquipmentManager />}
              </motion.div>
            </AnimatePresence>

            <footer className="mt-16 pt-8 border-t border-slate-200/60 pb-4 text-center text-xs text-slate-400 space-y-2">
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-medium">
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
                  className="hover:text-cyan-600 font-semibold transition underline underline-offset-2">Política de Privacidad</a>
                <span className="text-slate-300">•</span>
                <a href="/terms-of-service" target="_blank" rel="noopener noreferrer"
                  className="hover:text-cyan-600 font-semibold transition underline underline-offset-2">Términos de Servicio</a>
                <span className="text-slate-300">•</span>
                <span className="text-slate-400 font-medium">Soporte Escolar: info@pacificsurfschool.com</span>
              </div>
              <p className="font-sans leading-relaxed text-slate-400 max-w-xl mx-auto">
                © {new Date().getFullYear()} Pacific Surf School Manager.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
