
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, Cloud, 
  Database, AlertCircle, ExternalLink, BarChart3, Calendar,
  ChevronRight, List, Info, Gauge
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
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

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
    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) await fetchUserData(currentSession.user.id);
      } catch (e) {
        console.error("Error inicializando sesión:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) fetchUserData(newSession.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: fuelData, error } = await supabase
        .from('fuel_entries')
        .select('*')
        .eq('user_id', userId)
        .order('km_final', { ascending: true });

      if (error) throw error;
      
      if (fuelData) {
        setEntries(fuelData.map(d => ({
          ...d,
          fuelAmount: d.fuel_amount,
          pricePerLiter: d.price_per_liter,
          kmInicial: d.km_inicial,
          kmFinal: d.km_final
        })));
      }
    } catch (e) { 
      console.error("Error al obtener datos:", e); 
    }
  };

  useEffect(() => {
    if (entries.length > 0) {
      const calculated = calculateEntries(entries);
      setCalculatedEntries(calculated);
      setStats(getSummaryStats(calculated));
    }
  }, [entries]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = authMode === 'login' 
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) throw error;
    } catch (error: any) {
      alert(error.message);
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
        alert("Error al importar: " + err.message); 
      } finally { 
        setIsSyncing(false); 
      }
    };
    reader.readAsText(file);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const sorted = [...entries].sort((a, b) => a.kmFinal - b.kmFinal);
    const lastKm = sorted.length > 0 ? sorted[sorted.length - 1].kmFinal : 0;
    const kmFin = Number(newEntryForm.kmFinal);
    
    if (kmFin <= lastKm) {
      alert(`Error: El odómetro debe ser mayor que ${lastKm} km`);
      return;
    }

    setIsSyncing(true);
    try {
      const liters = Number(newEntryForm.fuelAmount);
      const pvp = Number(newEntryForm.pricePerLiter);
      const cost = liters * pvp;
      
      const newEntryObj = {
        user_id: session.user.id,
        date: newEntryForm.date.split('-').reverse().join('/'),
        km_inicial: lastKm,
        km_final: kmFin,
        distancia: kmFin - lastKm,
        fuel_amount: liters,
        price_per_liter: pvp,
        cost: cost
      };

      const { error } = await supabase.from('fuel_entries').insert([newEntryObj]);
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

  // Pantalla de error de configuración
  if (!isSupabaseConfigured && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
          <AlertCircle size={64} className="text-amber-500 mx-auto mb-8" />
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 text-center mb-4 leading-none">CONFIGURACIÓN<br/>PENDIENTE</h2>
          <p className="text-slate-500 text-center mb-10 text-sm leading-relaxed">
            Las variables de entorno no están configuradas correctamente en Vercel. Asegúrate de usar guiones bajos (_).
          </p>
          <div className="space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 block mb-1">KEY (Casilla izquierda)</span>
              <span className="text-xs font-black text-slate-700 select-all">SUPABASE_URL</span>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 block mb-1">KEY (Casilla izquierda)</span>
              <span className="text-xs font-black text-slate-700 select-all">SUPABASE_ANON_KEY</span>
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="mt-8 flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl">
            REINTENTAR <RefreshCw size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Pantalla de carga
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <RefreshCw size={48} className="text-emerald-500 animate-spin" />
        <p className="text-emerald-500 font-black tracking-widest uppercase text-xs">Sincronizando Sistema Cloud...</p>
      </div>
    );
  }

  // Pantalla de Login
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
          <div className="flex flex-col items-center mb-12">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 mb-6 rotate-3 shadow-xl">
              <Zap size={32} fill="currentColor" />
            </div>
            <h2 className="text-3xl font-black italic text-slate-900 leading-none uppercase tracking-tighter">FuelMaster Pro</h2>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-2">Toyota Analytics Engine</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
            <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Email" required />
            <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Contraseña" required />
            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-emerald-600 transition-all">
              {authMode === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-8 text-[10px] font-black uppercase text-slate-400 hover:text-emerald-500 transition-colors">
            {authMode === 'login' ? '¿Eres nuevo? Crea una cuenta' : '¿Ya tienes cuenta? Entra'}
          </button>
        </div>
      </div>
    );
  }

  const kmRemaining = stats ? serviceConfig.nextServiceKm - stats.lastOdometer : 0;
  const daysRemaining = getDaysRemaining(serviceConfig.nextServiceDate);

  // App Principal
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 font-sans">
      <button onClick={() => setShowNewEntry(true)} className="fixed bottom-10 right-10 z-[60] w-20 h-20 bg-slate-900 text-emerald-500 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-emerald-500/20 shadow-emerald-500/10"><Plus size={36} /></button>

      <nav className="h-28 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center px-10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 rotate-3 shadow-lg">
              <Zap size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">FuelMaster Pro</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Toyota C-HR Dashboard</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex mr-4">
              <button onClick={() => setView('dashboard')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
              <button onClick={() => setView('history')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Historial</button>
            </div>
            <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3"><Upload size={16} /> Importar</button>
            <button onClick={() => supabase.auth.signOut()} className="bg-white text-slate-400 h-14 w-14 rounded-2xl border border-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"><Trash2 size={22} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-12">
        {isSyncing && <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-10 py-4 rounded-full text-[10px] font-black uppercase animate-bounce shadow-2xl flex items-center gap-3 border-4 border-white"><RefreshCw size={16} className="animate-spin" /> Actualizando...</div>}

        {stats && stats.lastOdometer > 0 ? (
          <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
              <StatCard label="Consumo" value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20} />} color="bg-blue-600" />
              <StatCard label="Eficiencia" value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20} />} color="bg-indigo-600" />
              <StatCard label="Media €/100" value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20} />} color="bg-rose-600" />
              <StatCard label="Media PVP" value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20} />} color="bg-amber-600" />
              <StatCard label="Combustible" value={stats.totalFuel.toFixed(1)} unit="L" icon={<Fuel size={20} />} color="bg-emerald-600" />
              <StatCard label="Kilometraje" value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20} />} color="bg-slate-600" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <h3 className="font-black text-2xl italic uppercase text-slate-800 flex items-center gap-3 mb-10"><Wrench size={24} className="text-emerald-500" /> Mantenimiento</h3>
                  <div className="space-y-6">
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">Próximo Service <span>{serviceConfig.nextServiceKm.toLocaleString()} km</span></p>
                      <p className={`text-4xl font-black ${kmRemaining < 500 ? 'text-red-600' : 'text-slate-800'}`}>{kmRemaining.toLocaleString()} <span className="text-sm opacity-30 uppercase font-bold">km</span></p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">Fecha Límite <span>{serviceConfig.nextServiceDate.split('-').reverse().join('/')}</span></p>
                      <p className="text-4xl font-black text-blue-600">{daysRemaining} <span className="text-sm opacity-30 uppercase font-bold">días</span></p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-[4rem] p-16 text-slate-900 border border-slate-100 shadow-xl flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-slate-50 rounded-full blur-3xl opacity-50"></div>
                  <h2 className="text-3xl font-black italic uppercase mb-10 flex items-center gap-5 tracking-tighter text-slate-400"><Gauge size={40} className="text-emerald-500" /> Resumen Operativo</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inversión Total</p>
                      <p className="text-4xl font-black text-slate-900">{stats.totalCost.toFixed(2)}€</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KM Recorridos</p>
                      <p className="text-4xl font-black text-slate-900">{stats.totalDistance.toLocaleString()}k</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registros</p>
                      <p className="text-4xl font-black text-emerald-500">{entries.length}</p>
                    </div>
                  </div>
                  <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white">
                    <p className="text-lg italic leading-relaxed text-slate-300">
                      Análisis Cloud activo. Basado en tus {entries.length} registros, tu vehículo mantiene un rendimiento del {stats.avgKmPerLiter.toFixed(2)} km/L.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-10 flex items-center gap-3"><Activity size={18} className="text-blue-500" /> Consumo L/100km</h4>
                      <FuelChart data={calculatedEntries} type="consumption" />
                   </div>
                   <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-10 flex items-center gap-3"><Zap size={18} className="text-emerald-500" /> Eficiencia km/Litro</h4>
                      <FuelChart data={calculatedEntries} type="efficiency" />
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] border border-slate-100 shadow-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                    <tr>
                      <th className="px-12 py-10">Fecha</th>
                      <th className="px-12 py-10 text-right">Km Final</th>
                      <th className="px-12 py-10 text-right">Litros</th>
                      <th className="px-12 py-10 text-right text-emerald-600">L/100km</th>
                      <th className="px-12 py-10 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {calculatedEntries.slice().reverse().map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-all group">
                        <td className="px-12 py-8 text-sm font-black">{e.date}</td>
                        <td className="px-12 py-8 text-right text-sm font-bold text-slate-400">{e.kmFinal.toLocaleString()} km</td>
                        <td className="px-12 py-8 text-right text-sm font-medium">{e.fuelAmount.toFixed(2)} L</td>
                        <td className="px-12 py-8 text-right text-sm font-black text-emerald-600">{e.consumption.toFixed(2)}</td>
                        <td className="px-12 py-8 text-right">
                           <button onClick={() => {if(confirm("¿Borrar permanentemente?")) setEntries(entries.filter(x => x.id !== e.id))}} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-[5rem] border-8 border-dashed border-slate-50 p-32">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-10">
              <Database size={64} />
            </div>
            <h2 className="text-4xl font-black italic uppercase text-slate-900 mb-6 tracking-tighter">SIN DATOS</h2>
            <p className="text-slate-400 max-w-xl mb-16 text-xl font-medium italic">Sube tu historial de repostajes para activar el análisis.</p>
            <div className="flex gap-8">
              <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all flex items-center gap-4"><Upload size={24} /> Importar Datos</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-emerald-500 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-900 transition-all flex items-center gap-4"><Plus size={24} /> Nuevo Registro</button>
            </div>
          </div>
        )}
      </main>

      {/* Modales */}
      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] p-16 w-full max-w-2xl text-center relative shadow-2xl">
            <button onClick={() => setShowImport(false)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 transition-colors"><X size={40} /></button>
            <h3 className="text-4xl font-black italic uppercase mb-16 tracking-tighter">IMPORTAR CSV</h3>
            <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[3rem] p-20 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all group">
              <Upload className="mx-auto mb-8 text-slate-100 group-hover:text-emerald-500 transition-colors" size={80} />
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Seleccionar archivo</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <form onSubmit={handleAddEntry} className="bg-white rounded-[4rem] p-16 w-full max-w-xl relative shadow-2xl border-t-8 border-emerald-500">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 transition-colors"><X size={32} /></button>
            <h3 className="text-3xl font-black italic uppercase mb-12 tracking-tighter flex items-center gap-4"><Fuel className="text-emerald-500" /> REPOSTAJE</h3>
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Fecha</label>
                <input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Km Final</label>
                <input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} placeholder="Ej: 115034" className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Litros</label>
                  <input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} placeholder="00.00" className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">PVP (€/L)</label>
                  <input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} placeholder="0.000" className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black uppercase tracking-widest mt-16 shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4">Guardar Registro <ChevronRight size={20}/></button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
