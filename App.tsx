import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, 
  Database, Cloud, Lock, 
  Download, LayoutDashboard, History, LogOut, Key, Mail,
  AlertCircle, Smartphone
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, ServiceConfig } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import { exportToPDF } from './utils/pdfExport';
import StatCard from './components/StatCard';
import FuelChart from './components/FuelChart';

const LOCAL_STORAGE_KEY = 'fuelmaster_entries';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [calculatedEntries, setCalculatedEntries] = useState<CalculatedEntry[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history'>('dashboard');
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);

  const [serviceConfig] = useState<ServiceConfig>({
    nextServiceKm: 117041,
    nextServiceDate: '2026-01-22'
  });

  const [newEntryForm, setNewEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    kmFinal: '',
    fuelAmount: '',
    pricePerLiter: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initApp = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          setSession(currentSession);
          if (currentSession) {
            await fetchUserData(currentSession.user.id);
          } else {
            loadLocalData();
          }
        } catch (e) {
          console.error("Auth Session Error:", e);
          loadLocalData();
        }
      } else {
        loadLocalData();
      }
      setIsLoading(false);
    };

    initApp();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        if (newSession) fetchUserData(newSession.user.id);
        else setEntries([]);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const loadLocalData = () => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEntries(Array.isArray(parsed) ? parsed : []);
      } catch (e) { 
        setEntries([]);
      }
    }
  };

  const fetchUserData = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('fuel_entries')
        .select('*')
        .eq('user_id', userId)
        .order('km_final', { ascending: true });

      if (error) throw error;
      
      if (data) {
        const mapped = data.map(d => ({
          id: String(d.id),
          date: String(d.date),
          kmInicial: Number(d.km_inicial),
          kmFinal: Number(d.km_final),
          fuelAmount: Number(d.fuel_amount),
          pricePerLiter: Number(d.price_per_liter),
          cost: Number(d.cost),
          distancia: Number(d.distancia),
          consumption: 0,
          kmPerLiter: 0
        }));
        setEntries(mapped);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
      }
    } catch (e) {
      loadLocalData();
    }
  };

  useEffect(() => {
    if (entries && entries.length > 0) {
      const calculated = calculateEntries(entries);
      setCalculatedEntries(calculated);
      setStats(getSummaryStats(calculated));
    } else {
      setCalculatedEntries([]);
      setStats(null);
    }
  }, [entries]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) return;
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setAuthMode('login');
      }
    } catch (err: any) {
      setAuthError(err.message || "Error desconocido");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = parseFuelCSV(event.target?.result as string);
        if (isSupabaseConfigured && session) {
          const dbEntries = parsed.map(e => ({
            user_id: session.user.id,
            date: e.date,
            km_inicial: e.kmInicial,
            km_final: e.kmFinal,
            fuel_amount: e.fuelAmount,
            price_per_liter: e.pricePerLiter,
            cost: e.cost,
            distancia: e.distancia
          }));
          const { error } = await supabase.from('fuel_entries').insert(dbEntries);
          if (error) throw error;
          await fetchUserData(session.user.id);
        } else {
          const combined = [...entries, ...parsed];
          setEntries(combined);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
        }
        setShowImport(false);
      } catch (err: any) {
        alert("Error al importar CSV");
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-6">
        <RefreshCw className="text-emerald-500 animate-spin" size={48} />
        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.5em]">Inicializando Sistema...</p>
      </div>
    );
  }

  if (isSupabaseConfigured && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="premium-card w-full max-w-md p-10 space-y-8 animate-fade-in shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 mx-auto mb-6 shadow-lg shadow-emerald-500/20">
              <Lock size={32} />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">FuelMaster Pro</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Introduce tus credenciales de Supabase</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold uppercase tracking-wider">
                <AlertCircle size={16} /> {String(authError)}
              </div>
            )}
            <div className="space-y-4">
              <input 
                type="email" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)}
                placeholder="EMAIL"
                className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-emerald-500"
                required
              />
              <input 
                type="password" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)}
                placeholder="PASSWORD"
                className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-emerald-500"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isAuthLoading}
              className="w-full bg-emerald-500 text-slate-950 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
            >
              {isAuthLoading ? 'CONECTANDO...' : (authMode === 'login' ? 'ENTRAR' : 'REGISTRARSE')}
            </button>
          </form>

          <div className="text-center pt-4">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-500 transition-colors"
            >
              {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <nav className="h-24 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 flex items-center px-10 sticky top-0 z-[60]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-900 rotate-2">
              <Zap size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white">FuelMaster Pro</h1>
              <div className="flex items-center gap-2 mt-1">
                {isSupabaseConfigured ? <Cloud size={10} className="text-blue-400" /> : <Smartphone size={10} className="text-amber-400" />}
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                  {isSupabaseConfigured ? (session?.user?.email ? String(session.user.email) : "Cloud Sync") : "Modo Local"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-800/40 p-1 rounded-xl flex">
              <button onClick={() => setView('dashboard')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${view === 'dashboard' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}>
                Monitor
              </button>
              <button onClick={() => setView('history')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${view === 'history' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}>
                Historial
              </button>
            </div>
            <button onClick={() => setShowImport(true)} className="bg-white/5 h-12 px-6 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 border border-white/5 text-white">
              <Upload size={14} /> Importar
            </button>
            {session && (
              <button onClick={() => supabase.auth.signOut()} className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 animate-fade-in">
        {stats ? (
          <div className="space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <StatCard label="Consumo" value={String(stats.avgConsumption.toFixed(2))} unit="L/100" icon={<Activity size={20}/>} color="bg-blue-500" />
              <StatCard label="Eficiencia" value={String(stats.avgKmPerLiter.toFixed(2))} unit="km/L" icon={<Zap size={20}/>} color="bg-emerald-500" />
              <StatCard label="Media PVP" value={String(stats.avgPricePerLiter.toFixed(3))} unit="€/L" icon={<Euro size={20}/>} color="bg-amber-500" />
              <StatCard label="Gasto/100" value={String(stats.avgCostPer100Km.toFixed(2))} unit="€" icon={<TrendingUp size={20}/>} color="bg-rose-500" />
              <StatCard label="Litros" value={String(stats.totalFuel.toFixed(0))} unit="L" icon={<Fuel size={20}/>} color="bg-indigo-500" />
              <StatCard label="Odómetro" value={String(stats.lastOdometer.toLocaleString())} unit="km" icon={<Navigation size={20}/>} color="bg-slate-500" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-3 space-y-10">
                  <div className="premium-card p-10">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 italic">Análisis de Consumo</h3>
                    <FuelChart data={calculatedEntries} type="consumption" />
                  </div>
                  <div className="premium-card p-10">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 italic">Rendimiento Técnico</h3>
                    <FuelChart data={calculatedEntries} type="efficiency" />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="premium-card p-8">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400 mb-8 flex items-center gap-2"><Wrench size={16} /> MANTENIMIENTO</h3>
                    <div className="space-y-4">
                      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Restante Revisión</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white">{String(Math.max(0, serviceConfig.nextServiceKm - stats.lastOdometer).toLocaleString())}</span>
                          <span className="text-[10px] text-slate-500 font-black uppercase">km</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Días Estimados</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-blue-400">{String(getDaysRemaining(serviceConfig.nextServiceDate))}</span>
                          <span className="text-[10px] text-slate-500 font-black uppercase">días</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => exportToPDF(stats, calculatedEntries)} className="w-full h-24 premium-card flex flex-col items-center justify-center gap-2 border-emerald-500/10 hover:border-emerald-500/50 transition-all group">
                    <Download className="text-emerald-500 group-hover:scale-110" size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Exportar PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="premium-card overflow-hidden">
                <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                  <h3 className="text-lg font-black italic uppercase text-white">Bitácora de Repostajes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                      <tr>
                        <th className="px-8 py-6">Fecha</th>
                        <th className="px-8 py-6 text-right">Odo</th>
                        <th className="px-8 py-6 text-right text-emerald-500">L/100km</th>
                        <th className="px-8 py-6 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {calculatedEntries.slice().reverse().map((e) => (
                        <tr key={String(e.id)} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-8 py-6 text-sm font-bold text-slate-300">{String(e.date)}</td>
                          <td className="px-8 py-6 text-right text-sm font-bold text-slate-400">{String(e.kmFinal.toLocaleString())}</td>
                          <td className="px-8 py-6 text-right text-base font-black text-emerald-500 italic">{String(e.consumption.toFixed(2))}</td>
                          <td className="px-8 py-6 text-right">
                             <button onClick={async () => {
                               if(confirm("¿Eliminar registro?")) {
                                 if (isSupabaseConfigured && session) {
                                   await supabase.from('fuel_entries').delete().eq('id', e.id);
                                   fetchUserData(session.user.id);
                                 } else {
                                   const filtered = entries.filter(ent => ent.id !== e.id);
                                   setEntries(filtered);
                                   localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
                                 }
                               }
                             }} className="p-2 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                               <Trash2 size={18}/>
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] premium-card border-dashed border-2 border-slate-800 p-20">
            <Database className="mb-8 text-slate-800" size={64} />
            <h2 className="text-3xl font-black italic uppercase text-white mb-4">Sin Datos</h2>
            <div className="flex gap-4">
              <button onClick={() => setShowImport(true)} className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Importar CSV</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-slate-800 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest">Nuevo Registro</button>
            </div>
          </div>
        )}
      </main>

      <button onClick={() => setShowNewEntry(true)} className="fixed bottom-10 right-10 w-16 h-16 bg-emerald-500 text-slate-950 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[70]">
        <Plus size={28} />
      </button>

      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in">
          <div className="premium-card w-full max-w-xl p-12 relative">
            <button onClick={() => setShowImport(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors">
              <X size={32}/>
            </button>
            <h3 className="text-xl font-black italic uppercase mb-10 text-white">Importación</h3>
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-800 rounded-3xl p-16 text-center hover:border-emerald-500/50 cursor-pointer group transition-all">
              <Upload className="mx-auto mb-6 text-slate-800 group-hover:text-emerald-500" size={56} />
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Subir archivo .csv</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in">
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const liters = Number(newEntryForm.fuelAmount);
              const pvp = Number(newEntryForm.pricePerLiter);
              const kmFin = Number(newEntryForm.kmFinal);
              const lastEntry = calculatedEntries[calculatedEntries.length - 1];
              const kmIni = lastEntry ? lastEntry.kmFinal : kmFin - 500;
              
              const newEntry: FuelEntry = {
                id: `entry-${Date.now()}`,
                date: newEntryForm.date.split('-').reverse().join('/'),
                kmInicial: kmIni,
                kmFinal: kmFin,
                fuelAmount: liters,
                pricePerLiter: pvp,
                cost: liters * pvp,
                distancia: kmFin - kmIni,
                consumption: 0,
                kmPerLiter: 0
              };

              if (isSupabaseConfigured && session) {
                const dbEntry = {
                  user_id: session.user.id,
                  date: newEntry.date,
                  km_inicial: newEntry.kmInicial,
                  km_final: newEntry.kmFinal,
                  fuel_amount: newEntry.fuelAmount,
                  price_per_liter: newEntry.pricePerLiter,
                  cost: newEntry.cost,
                  distancia: newEntry.distancia
                };
                const { error } = await supabase.from('fuel_entries').insert([dbEntry]);
                if (error) alert(error.message);
                else {
                  await fetchUserData(session.user.id);
                  setShowNewEntry(false);
                }
              } else {
                const newEntries = [...entries, newEntry];
                setEntries(newEntries);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newEntries));
                setShowNewEntry(false);
              }
            }} 
            className="premium-card w-full max-w-lg p-12 relative border-t-4 border-t-emerald-500"
          >
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors">
              <X size={32}/>
            </button>
            <h3 className="text-xl font-black italic uppercase mb-10 text-white flex items-center gap-3">
              <Fuel className="text-emerald-500" /> Nuevo Registro
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required />
              <input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} placeholder="ODÓMETRO" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required />
              <input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} placeholder="LITROS" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required />
              <input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} placeholder="PVP €/L" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required />
            </div>
            
            <button type="submit" className="w-full bg-emerald-500 text-slate-950 py-6 rounded-xl font-black uppercase tracking-widest mt-10 shadow-lg hover:bg-emerald-400 transition-all">Sincronizar Cloud</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;