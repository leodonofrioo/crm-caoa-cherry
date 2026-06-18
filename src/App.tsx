/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import Dashboard from './components/Dashboard';
import Kanban from './components/Kanban';
import VendaForm from './components/VendaForm';
import AccessoriesList from './components/AccessoriesList';
import Comissoes from './components/Comissoes';
import SettingsModal from './components/SettingsModal';
import InstallationsCalendar from './components/InstallationsCalendar';
import {
  LayoutDashboard,
  Columns4,
  ShoppingBag,
  ListOrdered,
  CalendarDays,
  DollarSign,
  UserCheck,
  Award,
  Settings,
  LogOut,
  LockKeyhole,
} from 'lucide-react';
import { SalesStatus } from './types';

interface AuthUser {
  login: string;
  displayName: string;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({login, password}),
      });
      const result = await response.json() as { ok?: boolean; user?: AuthUser; message?: string };

      if (!response.ok || !result.ok || !result.user) {
        setError(result.message || 'Login ou senha inválidos.');
        return;
      }

      onAuthenticated(result.user);
    } catch {
      setError('Não foi possível validar o acesso agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl space-y-5"
      >
        <div className="space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#002C5F] text-white">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Acesso ao CRM</h1>
            <p className="text-xs font-semibold text-slate-500">Sessão protegida por credenciais locais.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Login</label>
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-300 focus:bg-white"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-300 focus:bg-white"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-[#002C5F] px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-950 disabled:bg-slate-300"
        >
          {isSubmitting ? 'Validando' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

function AuthGate({ children }: { children: (user: AuthUser, onLogout: () => void) => React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json() as { ok?: boolean; user?: AuthUser };
        if (!response.ok || !result.ok || !result.user) throw new Error('Sessão inválida.');
        setUser(result.user);
        setStatus('authenticated');
      })
      .catch(() => {
        setStatus('unauthenticated');
      });
  }, []);

  const handleAuthenticated = (nextUser: AuthUser) => {
    setUser(nextUser);
    setStatus('authenticated');
  };

  const handleLogout = () => {
    setUser(null);
    setStatus('unauthenticated');
    void fetch('/api/auth/logout', {method: 'POST', credentials: 'include'});
  };

  if (status === 'checking') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-xs font-black uppercase tracking-widest text-slate-300">Validando sessão</div>
      </main>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  return <>{children(user, handleLogout)}</>;
}

function NavigationLayout({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [createSaleRequest, setCreateSaleRequest] = useState<{ id: number; status: SalesStatus } | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const { settings } = useCRM();

  // Navigation tabs item spec
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kanban', label: 'Pipeline Kanban', icon: Columns4 },
    { id: 'venda', label: 'Propostas / Vendas', icon: ListOrdered },
    { id: 'installations', label: 'Calendário de Instalações', icon: CalendarDays },
    { id: 'accessories', label: 'Acessórios catálogo', icon: ShoppingBag },
    { id: 'comissoes', label: 'Minhas Comissões', icon: DollarSign },
  ];

  // Helper to deep navigate from child elements
  const handleDeepNavigate = (tabId: string, saleId: string) => {
    setActiveTab(tabId);
    setSelectedSaleId(saleId);
  };

  const handleCreateSaleFromKanban = (status: SalesStatus) => {
    setSelectedSaleId(null);
    setCreateSaleRequest({ id: Date.now(), status });
    setActiveTab('venda');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header bar */}
      <header className="no-print bg-white border-b border-slate-200 shadow-xs shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/brands/caoa-chery-logo.png"
              alt="CAOA CHERY"
              className="h-12 w-32 shrink-0 object-contain"
            />
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <h1 className="text-sm sm:text-base font-bold leading-none tracking-tight text-[#002C5F] truncate">Accessories CRM</h1>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-medium truncate">Thayná Reis · {settings.dealerName}</span>
            </div>
          </div>

          {/* Active seed user profile badge & Settings button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-xs"
              title="Ajustar Meta e Veículos"
            >
              <Settings className="w-4 h-4 text-[#002C5F] animate-pulse" />
              <span className="hidden md:inline">Configurações</span>
            </button>

            <div className="flex items-center gap-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all">
              <div className="text-right leading-none hidden sm:block">
                <span className="text-xs font-bold text-slate-800 block">{user.displayName}</span>
                <span className="text-[9px] text-green-600 font-bold tracking-wide uppercase">SESSÃO ATIVA</span>
              </div>
              <div className="text-right leading-none sm:hidden">
                <span className="text-[9px] text-green-600 font-bold tracking-wide uppercase">ATIVO</span>
              </div>
              <div className="w-8 h-8 bg-[#002C5F] rounded-full border border-slate-200 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content body (Layout Sidebar + Main Grid Content) */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Navigation panel */}
        <aside className="no-print w-full md:w-64 shrink-0">
          <nav className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1.5 md:sticky md:top-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-3">
              Rotas do Sistema
            </span>
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'venda') setSelectedSaleId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs font-semibold cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#002C5F] text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content render body */}
        <main className="flex-1 min-w-0 bg-transparent">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onSelectSale={(id) => handleDeepNavigate('venda', id)}
            />
          )}
          {activeTab === 'kanban' && (
            <Kanban
              onSelectSale={(id) => handleDeepNavigate('venda', id)}
              onCreateSale={handleCreateSaleFromKanban}
            />
          )}
          {activeTab === 'venda' && (
            <VendaForm
              selectedSaleId={selectedSaleId}
              onClearSelectedSale={() => setSelectedSaleId(null)}
              createRequest={createSaleRequest}
              onCreateRequestConsumed={() => setCreateSaleRequest(null)}
            />
          )}
          {activeTab === 'installations' && (
            <InstallationsCalendar onSelectSale={(id) => handleDeepNavigate('venda', id)} />
          )}
          {activeTab === 'accessories' && <AccessoriesList />}
          {activeTab === 'comissoes' && <Comissoes />}
        </main>
      </div>

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Footer bar */}
      <footer className="no-print mt-auto py-6 border-t border-slate-100 text-slate-400 text-[11px] font-sans text-center">
        <span>CRM Thayná Reis · Catálogo CAOA Chery · Uso Interno · 2026</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(user, onLogout) => (
        <CRMProvider>
          <NavigationLayout user={user} onLogout={onLogout} />
        </CRMProvider>
      )}
    </AuthGate>
  );
}
