import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, 
  Database, AlertCircle, BarChart3, 
  ChevronRight, Gauge, User, ShieldCheck
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, ServiceConfig } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import StatCard from './components/StatCard';
import FuelChart from './components/FuelChart';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [calculatedEntries, setCalculatedEntries] = useState<CalculatedEntry[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [view, setView] = useState<'dashboard' | 'history'>('dashboard');
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

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
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) {
          await fetchUserData(currentSession.user.id);
        }
      } catch (e) {
        console.error("Error inicializando Supabase:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) fetchUserData(newSession.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    setIsSyncing(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('fuel_entries')
        .select('*')
        .eq('user_id', userId)
        .order('km_final', { ascending: true });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "fuel_entries" does not exist')) {
          setDbError("La tabla 'fuel_entries' no ha sido creada en Supabase. Por favor, ejecuta el script SQL.");
        }
        throw error;
      }
      
      if (data) {
        setEntries(data.map(d => ({
          ...d,
          fuelAmount: d.fuel_amount,
          pricePerLiter: d.price_per_liter,
          kmInicial: d.km_inicial,
          kmFinal: d.km_final
        })));
      }
    } catch (e) {
      console.error("Error al obtener datos:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (entries.length > 0) {
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
    setIsLoading(true);
    setAuthError(null);
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
        alert("¡Cuenta creada! Verifica tu correo electrónico.");
      }
    } catch (error: any) {
      setAuthError(error.message === 'Invalid login credentials' 
        ? "Email o contraseña incorrectos." 
        : error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = parseFuelCSV(event.target?.result as string);
        setIsSyncing(true);
        
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
        setShowImport(false);
      } catch (err: any) {
        alert("Error de importación: " + err.message);
      } finally {
        setIsSyncing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    
    setIsSyncing(true);
    try {
      const liters = Number(newEntryForm.fuelAmount);
      const pvp = Number(newEntryForm.pricePerLiter);
      const kmFin = Number(newEntryForm.kmFinal);
      const cost = liters * pvp;
      
      const lastEntry = calculatedEntries[calculatedEntries.length - 1];
      const kmIni = lastEntry ? lastEntry.kmFinal : kmFin - 500;

      const { error } = await supabase.from('fuel_entries').insert([{
        user_id: session.user.id,
        date: newEntryForm.date.split('-').reverse().join('/'),
        km_inicial: kmIni,
        km_final: kmFin,
        fuel_amount: liters,
        price_per_liter: pvp,
        cost: cost,
        distancia: kmFin - kmIni
      }]);

      if (error) throw error;
      
      await fetchUserData(session.user.id);
      setShowNewEntry(false);
      setNewEntryForm({ 
        date: new Date().toISOString().split('T')[0], 
        kmFinal: '', 
        fuelAmount: '', 
        pricePerLiter: '' 
      });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEntries([]);
    setCalculatedEntries([]);
    setStats(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <RefreshCw className="text-emerald-500 animate-spin" size={48} />
        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em]">Iniciando FuelMaster...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl rounded-[3rem] p-12 border border-white/5 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-12">
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-slate-900 mb-6 rotate-3 shadow-xl shadow-emerald-500/20">
              <Zap size={40} fill="currentColor" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">FuelMaster Pro</h1>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.4em] mt-2">Toyota Sync System</p>
          </div>

          {authError && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold flex items-center gap-3">
              <AlertCircle size={18} /> {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4 tracking-widest">Acceso Sincronizado</label>
              <input 
                type="email" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-5 px-8 font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" 
                placeholder="Email" 
                required 
              />
              <input 
                type="password" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-5 px-8 font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" 
                placeholder="Contraseña" 
                required 
              />
            </div>
            <button type="submit" className="w-full bg-emerald-500 text-slate-900 py-6 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
              {authMode === 'login' ? 'Conectar Dispositivo' : 'Crear Nueva Cuenta'}
            </button>
          </form>

          <button 
            onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(null); }} 
            className="w-full mt-10 text-[10px] font-black uppercase text-slate-500 hover:text-emerald-500 transition-colors tracking-widest"
          >
            {authMode === 'login' ? '¿Sin cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20 selection:bg-emerald-500 selection:text-white">
      <nav className="h-28 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 flex items-center px-10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-900 rotate-3 shadow-lg shadow-emerald-500/20">
              <Zap size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">FuelMaster Pro</h1>
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Toyota Cloud Analytics</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-800/50 p-1.5 rounded-2xl flex mr-4">
              <button onClick={() => setView('dashboard')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}>Monitor</button>
              <button onClick={() => setView('history')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'history' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}>Historial</button>
            </div>
            <button onClick={() => setShowImport(true)} className="bg-white text-slate-900 h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-500 transition-all flex items-center gap-3"><Upload size={16} /> Importar</button>
            <button onClick={handleLogout} className="bg-slate-800 text-slate-400 h-14 w-14 rounded-2xl border border-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all" title="Salir"><Trash2 size={22} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {dbError && (
          <div className="mb-10 p-6 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2rem] flex items-start gap-6 animate-pulse">
            <AlertCircle className="text-amber-500 shrink-0" size={32} />
            <div>
              <h4 className="text-amber-500 font-black uppercase text-sm tracking-widest mb-1">Configuración pendiente en Supabase</h4>
              <p className="text-slate-400 text-sm font-medium">{dbError}</p>
            </div>
          </div>
        )}

        {isSyncing && (
          <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-slate-900 px-10 py-4 rounded-full text-[10px] font-black uppercase animate-bounce shadow-2xl flex items-center gap-3 border-4 border-[#0f172a]">
            <RefreshCw size={16} className="animate-spin" /> Sincronizando datos...
          </div>
        )}

        {stats ? (
          <div className="space-y-16">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <StatCard label="Consumo" value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20}/>} color="bg-blue-500" />
              <StatCard label="Eficiencia" value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20}/>} color="bg-emerald-500" />
              <StatCard label="Media PVP" value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20}/>} color="bg-amber-500" />
              <StatCard label="Gasto/100" value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20}/>} color="bg-rose-500" />
              <StatCard label="Litros" value={stats.totalFuel.toFixed(0)} unit="L" icon={<Fuel size={20}/>} color="bg-indigo-500" />
              <StatCard label="Odómetro" value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20}/>} color="bg-slate-500" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-12">
                  <div className="bg-slate-900/50 rounded-[3rem] p-12 border border-white/5">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 italic">Evolución Energética L/100km</h3>
                    <FuelChart data={calculatedEntries} type="consumption" />
                  </div>
                  <div className="bg-slate-900/50 rounded-[3rem] p-12 border border-white/5">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 italic">Rendimiento Real km/L</h3>
                    <FuelChart data={calculatedEntries} type="efficiency" />
                  </div>
                </div>
                <div className="space-y-10">
                  <div className="bg-slate-900/50 rounded-[3rem] p-10 border border-white/5">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-10 flex items-center gap-3 italic"><Wrench size={16} className="text-emerald-500" /> Mantenimiento</h3>
                    <div className="space-y-8">
                      <div className="p-8 bg-slate-800/30 rounded-[2rem] border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Próximo Service</p>
                        <p className={`text-4xl font-black ${getDaysRemaining(serviceConfig.nextServiceDate) < 30 ? 'text-red-500' : 'text-white'}`}>{(serviceConfig.nextServiceKm - (stats?.lastOdometer || 0)).toLocaleString()} <span className="text-xs opacity-30">km</span></p>
                      </div>
                      <div className="p-8 bg-slate-800/30 rounded-[2rem] border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Fecha Estimada</p>
                        <p className="text-4xl font-black text-blue-400">{getDaysRemaining(serviceConfig.nextServiceDate)} <span className="text-xs opacity-30">días</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-emerald-500 rounded-[3rem] p-10 text-slate-900 shadow-2xl shadow-emerald-500/10 group overflow-hidden relative">
                    <div className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                      <Gauge size={180} />
                    </div>
                    <h4 className="text-3xl font-black italic uppercase leading-none mb-2">RESUMEN CLOUD</h4>
                    <p className="text-[10px] font-bold uppercase opacity-60 mb-10 tracking-widest">Sincronización Activa</p>
                    <div className="space-y-6 relative z-10">
                      <div className="flex justify-between items-center border-b border-slate-900/10 pb-3">
                        <span className="text-[10px] font-black uppercase">Inversión Total</span>
                        <span className="font-black text-lg">{stats.totalCost.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-900/10 pb-3">
                        <span className="text-[10px] font-black uppercase">Distancia Total</span>
                        <span className="font-black text-lg">{stats.totalDistance.toLocaleString()}km</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 rounded-[3.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-10 border-b border-white/5 bg-white/[0.02]">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter">Histórico de Repostajes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/30 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                      <tr>
                        <th className="px-12 py-8">Fecha</th>
                        <th className="px-12 py-8 text-right">Odómetro</th>
                        <th className="px-12 py-8 text-right">Carga L</th>
                        <th className="px-12 py-8 text-right text-emerald-500">L/100km</th>
                        <th className="px-12 py-8 text-right">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {calculatedEntries.slice().reverse().map((e) => (
                        <tr key={e.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-12 py-8 text-sm font-bold italic">{e.date}</td>
                          <td className="px-12 py-8 text-right text-sm font-bold text-slate-400">{e.kmFinal.toLocaleString()} km</td>
                          <td className="px-12 py-8 text-right text-sm font-black">{e.fuelAmount.toFixed(2)} L</td>
                          <td className="px-12 py-8 text-right text-base font-black text-emerald-500">{e.consumption.toFixed(2)}</td>
                          <td className="px-12 py-8 text-right">
                             <button onClick={async () => {
                               if(confirm("¿Eliminar registro de la nube?")) {
                                 const { error } = await supabase.from('fuel_entries').delete().eq('id', e.id);
                                 if(!error) fetchUserData(session.user.id);
                               }
                             }} className="p-3 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                               <Trash2 size={20}/>
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
          <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-900/30 rounded-[4rem] border-4 border-dashed border-white/5 p-20">
            <Database size={80} className="text-slate-800 mb-10" />
            <h2 className="text-4xl font-black italic uppercase mb-4 tracking-tighter">SIN DATOS CLOUD</h2>
            <p className="text-slate-500 mb-16 font-bold uppercase text-xs tracking-[0.3em]">Sincroniza tu primer reporte Toyota</p>
            <div className="flex gap-8">
              <button onClick={() => setShowImport(true)} className="bg-white text-slate-900 px-12 py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-emerald-500 transition-all shadow-2xl">Importar CSV</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-slate-800 text-white px-12 py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-700 transition-all border border-white/5">Nuevo Registro</button>
            </div>
          </div>
        )}
      </main>

      <button onClick={() => setShowNewEntry(true)} className="fixed bottom-12 right-12 w-20 h-20 bg-emerald-500 text-slate-900 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 shadow-emerald-500/30">
        <Plus size={36} />
      </button>

      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-8">
          <div className="bg-slate-900 w-full max-w-2xl rounded-[3.5rem] p-16 border border-white/5 relative shadow-2xl">
            <button onClick={() => setShowImport(false)} className="absolute top-12 right-12 text-slate-500 hover:text-white transition-colors"><X size={40}/></button>
            <h3 className="text-3xl font-black italic uppercase mb-12 tracking-tighter">CARGA DE SISTEMA</h3>
            <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-800 rounded-[2.5rem] p-24 text-center hover:border-emerald-500/50 cursor-pointer transition-all group hover:bg-emerald-500/5">
              <Upload className="mx-auto mb-10 text-slate-800 group-hover:text-emerald-500 transition-all group-hover:-translate-y-2" size={80} />
              <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.4em]">Seleccionar archivo CSV</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-8">
          <form onSubmit={handleAddEntry} className="bg-slate-900 w-full max-w-xl rounded-[3.5rem] p-16 border border-emerald-500/20 relative shadow-2xl border-t-[12px]">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-12 right-12 text-slate-500 hover:text-white transition-colors"><X size={40}/></button>
            <h3 className="text-3xl font-black italic uppercase mb-12 tracking-tighter flex items-center gap-6"><Fuel className="text-emerald-500" /> LOG DE CARGA</h3>
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-4 italic tracking-widest">Fecha</label>
                <input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl py-5 px-10 font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-4 italic tracking-widest">Kilometraje Total</label>
                <input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} placeholder="000000" className="w-full bg-slate-800 border-none rounded-2xl py-5 px-10 font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-4 italic tracking-widest">Litros</label>
                  <input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} placeholder="00.00" className="w-full bg-slate-800 border-none rounded-2xl py-5 px-10 font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-4 italic tracking-widest">Precio €/L</label>
                  <input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} placeholder="0.000" className="w-full bg-slate-800 border-none rounded-2xl py-5 px-10 font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-500 text-slate-900 py-8 rounded-[2rem] font-black uppercase tracking-widest mt-16 hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 text-sm">ENVIAR A LA NUBE</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;