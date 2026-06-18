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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070B] p-4 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#05070B_0%,#07111f_48%,#001f43_100%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-[#D71920]" />
      <div className="absolute bottom-0 left-0 h-24 w-full bg-[linear-gradient(180deg,transparent_0%,rgba(215,25,32,0.12)_100%)]" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden min-h-[560px] flex-col justify-between bg-[#07111f] p-10 text-white lg:flex">
          <div>
            <img
              src="/brands/caoa-chery-logo.png"
              alt="CAOA CHERY"
              className="h-28 w-72 object-contain object-left"
            />
            <div className="mt-10 max-w-md">
              <h1 className="text-4xl font-black uppercase leading-tight tracking-tight">
                Accessories CRM
              </h1>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
                Gestão de propostas, acessórios, instalação e comissões com padrão CAOA Chery.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border-l-2 border-[#D71920] bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 font-black uppercase tracking-widest text-white">
                <UserCheck className="h-4 w-4 text-[#D71920]" />
                Sessão
              </div>
              <p className="mt-2 font-semibold text-slate-300">Acesso local protegido.</p>
            </div>
            <div className="border-l-2 border-[#D71920] bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 font-black uppercase tracking-widest text-white">
                <Award className="h-4 w-4 text-[#D71920]" />
                Vendas
              </div>
              <p className="mt-2 font-semibold text-slate-300">Catálogo e comissão no mesmo fluxo.</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-[560px] flex-col justify-center bg-white p-6 text-slate-900 sm:p-10"
        >
          <div className="space-y-7">
            <h1 className="sr-only">Acesso ao CRM</h1>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Login</label>
                <input
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                  placeholder="Usuário"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-[#002C5F] focus:bg-white focus:ring-4 focus:ring-blue-950/10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Senha de acesso"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-[#002C5F] focus:bg-white focus:ring-4 focus:ring-blue-950/10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#002C5F] px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-950/20 transition-all hover:bg-blue-950 disabled:bg-slate-300 disabled:shadow-none"
            >
              {isSubmitting ? 'Validando' : 'Entrar'}
            </button>
          </div>
        </form>
      </section>
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
      <main className="flex min-h-screen items-center justify-center bg-[#05070B] text-white">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/brands/caoa-chery-logo.png"
            alt="CAOA CHERY"
            className="h-20 w-56 object-contain"
          />
          <div className="text-xs font-black uppercase tracking-widest text-slate-300">Validando sessão</div>
        </div>
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
