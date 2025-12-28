
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, Cloud, 
  Database, AlertCircle, ExternalLink, BarChart3, Calendar,
  ChevronRight, List, Info
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
  
  // Auth States
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Modals
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
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) await fetchUserData(currentSession.user.id);
      } catch (e) {
        console.error("Auth init error:", e);
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
      console.error("Error cargando datos:", e); 
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
        setEntries(prev => [...prev, ...parsed].sort((a,b) => a.kmFinal - b.kmFinal));
        setShowImport(false);
      } catch (err: any) { 
        alert("Error de sincronización: " + err.message); 
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
      alert(`Error: El odómetro debe ser superior al último registro (${lastKm} km)`);
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

      const { data, error } = await supabase.from('fuel_entries').insert([newEntryObj]).select();
      if (error) throw error;

      setEntries([...entries, {
        id: data[0].id,
        date: newEntryObj.date,
        kmInicial: newEntryObj.km_inicial,
        kmFinal: newEntryObj.km_final,
        distancia: newEntryObj.distancia,
        fuelAmount: newEntryObj.fuel_amount,
        pricePerLiter: newEntryObj.price_per_liter,
        cost: newEntryObj.cost,
        consumption: 0,
        kmPerLiter: 0
      }]);
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

  const kmRemaining = stats ? serviceConfig.nextServiceKm - stats.lastOdometer : 0;
  const daysRemaining = getDaysRemaining(serviceConfig.nextServiceDate);

  // Pantalla de Configuración Pendiente (Vercel/Netlify)
  if (!isSupabaseConfigured && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
          <AlertCircle size={64} className="text-amber-500 mx-auto mb-8" />
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 text-center mb-4 leading-none">VINCULACIÓN<br/>PENDIENTE</h2>
          <p className="text-slate-500 text-center mb-10 text-sm leading-relaxed">
            Tu App está en GitHub, pero falta conectar los cables. Añade las llaves de Supabase en <b>Environment Variables</b> de tu hosting.
          </p>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <code className="text-[10px] font-bold text-slate-400 block mb-1">KEY 1</code>
              <p className="text-xs font-black text-slate-700">SUPABASE_URL</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <code className="text-[10px] font-bold text-slate-400 block mb-1">KEY 2</code>
              <p className="text-xs font-black text-slate-700">SUPABASE_ANON_KEY</p>
            </div>
          </div>
          <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" className="mt-10 flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl">
            Abrir Supabase <ExternalLink size={14} />
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black tracking-widest animate-pulse uppercase">Iniciando Cloud Analytics...</div>;

  // Login / Registro
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
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-2">Acceso Cloud Seguro</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Email de Usuario</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="tucorreo@ejemplo.com" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Contraseña</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-emerald-600 transition-all mt-4">
              {authMode === 'login' ? 'Entrar al Ecosistema' : 'Crear Nueva Cuenta'}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-8 text-[10px] font-black uppercase text-slate-400 hover:text-emerald-500 transition-colors">
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya eres usuario? Inicia sesión'}
          </button>
        </div>
      </div>
    );
  }

  // App Principal
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 font-sans">
      <button onClick={() => setShowNewEntry(true)} className="fixed bottom-10 right-10 z-[60] w-20 h-20 bg-slate-900 text-emerald-500 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-emerald-500/20 shadow-emerald-500/10"><Plus size={36} /></button>

      {/* Nav */}
      <nav className="h-28 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center px-10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 rotate-3 shadow-lg">
              <Zap size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">FuelMaster Pro</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Online: {session.user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex">
              <button onClick={() => setView('dashboard')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${view === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><BarChart3 size={14}/> Dashboard</button>
              <button onClick={() => setView('history')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${view === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List size={14}/> Historial</button>
            </div>
            <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3"><Upload size={16} /> Importar</button>
            <button onClick={() => supabase.auth.signOut()} className="bg-white text-slate-400 h-14 w-14 rounded-2xl border border-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"><Trash2 size={22} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-12">
        {isSyncing && <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-10 py-4 rounded-full text-[10px] font-black uppercase animate-bounce shadow-2xl flex items-center gap-3 border-4 border-white"><RefreshCw size={16} className="animate-spin" /> Sincronizando con la Nube...</div>}

        {stats && stats.lastOdometer > 0 ? (
          <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
              <StatCard label="Consumo Real" value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20} />} color="bg-blue-600" />
              <StatCard label="Eficiencia" value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20} />} color="bg-indigo-600" />
              <StatCard label="Coste Medio" value={stats.avgCostPer100Km.toFixed(2)} unit="€/100" icon={<TrendingUp size={20} />} color="bg-rose-600" />
              <StatCard label="PVP Medio" value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20} />} color="bg-amber-600" />
              <StatCard label="Combustible" value={stats.totalFuel.toFixed(1)} unit="L" icon={<Fuel size={20} />} color="bg-emerald-600" />
              <StatCard label="Odómetro" value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20} />} color="bg-slate-600" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <h3 className="font-black text-2xl italic uppercase text-slate-800 flex items-center gap-3 mb-10"><Wrench size={24} className="text-emerald-500" /> Mantenimiento</h3>
                  <div className="space-y-6">
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 text-slate-100 group-hover:text-emerald-500/10 transition-colors"><Info size={48} /></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">Próxima Revisión <span>{serviceConfig.nextServiceKm.toLocaleString()} km</span></p>
                      <p className={`text-4xl font-black ${kmRemaining < 500 ? 'text-red-600' : 'text-slate-800'}`}>{kmRemaining.toLocaleString()} <span className="text-sm opacity-30 uppercase font-bold">km faltan</span></p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">Fecha Límite <span>{serviceConfig.nextServiceDate.split('-').reverse().join('/')}</span></p>
                      <p className="text-4xl font-black text-blue-600">{daysRemaining} <span className="text-sm opacity-30 uppercase font-bold">días</span></p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900 rounded-[4rem] p-16 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center border-b-8 border-emerald-500">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
                  <div className="relative z-10">
                    <h2 className="text-4xl font-black italic uppercase mb-10 flex items-center gap-5 tracking-tighter"><Database size={40} className="text-emerald-500" /> RESUMEN DE FLOTA</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Repostajes</p>
                        <p className="text-4xl font-black text-white">{entries.length}</p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">Base de Datos OK</p>
                      </div>
                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Inversión</p>
                        <p className="text-4xl font-black text-white">{stats.totalCost.toFixed(2)}€</p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">Coste Acumulado</p>
                      </div>
                      <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Distancia</p>
                        <p className="text-4xl font-black text-white">{stats.totalDistance.toLocaleString()}k</p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">KM Analizados</p>
                      </div>
                    </div>
                    <p className="text-xl italic text-slate-300 leading-relaxed border-l-4 border-emerald-500 pl-8 bg-white/5 py-4 rounded-r-2xl">
                      Análisis de datos activo. El Toyota C-HR mantiene una eficiencia media del {(stats.avgKmPerLiter).toFixed(2)} km por cada litro de combustible. No se detectan anomalías en los últimos registros.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                      <div className="absolute top-8 right-12 text-slate-50"><TrendingUp size={80} /></div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-10 flex items-center gap-3"><Activity size={18} className="text-blue-500" /> Curva de Consumo L/100km</h4>
                      <FuelChart data={calculatedEntries} type="consumption" />
                   </div>
                   <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                      <div className="absolute top-8 right-12 text-slate-50"><Zap size={80} /></div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-10 flex items-center gap-3"><Zap size={18} className="text-emerald-500" /> Eficiencia km/Litro</h4>
                      <FuelChart data={calculatedEntries} type="efficiency" />
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] border border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 duration-700">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                    <tr>
                      <th className="px-12 py-10 flex items-center gap-3"><Calendar size={14} /> Fecha Registro</th>
                      <th className="px-12 py-10 text-right">Odómetro</th>
                      <th className="px-12 py-10 text-right">Tramo (km)</th>
                      <th className="px-12 py-10 text-right">Llenado</th>
                      <th className="px-12 py-10 text-right text-emerald-600">L/100km</th>
                      <th className="px-12 py-10 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {calculatedEntries.slice().reverse().map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-all group">
                        <td className="px-12 py-8 text-sm font-black text-slate-800">{e.date}</td>
                        <td className="px-12 py-8 text-right text-sm font-bold text-slate-400">{e.kmFinal.toLocaleString()} km</td>
                        <td className="px-12 py-8 text-right text-sm font-bold text-slate-600">{e.distancia} km</td>
                        <td className="px-12 py-8 text-right text-sm font-medium">{e.fuelAmount.toFixed(2)} L <span className="text-[10px] text-slate-300 ml-1">({e.pricePerLiter.toFixed(3)}€)</span></td>
                        <td className="px-12 py-8 text-right text-sm font-black text-emerald-600 bg-emerald-50/30">{e.consumption.toFixed(2)}</td>
                        <td className="px-12 py-8 text-right">
                           <button onClick={() => {if(confirm("¿Eliminar registro de la nube permanentemente?")) setEntries(entries.filter(x => x.id !== e.id))}} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 rounded-xl"><Trash2 size={20}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-center bg-white rounded-[5rem] border-8 border-dashed border-slate-50 p-32">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-10 shadow-inner">
              <Database size={64} />
            </div>
            <h2 className="text-5xl font-black italic uppercase text-slate-900 mb-8 tracking-tighter leading-none">SIN DATOS EN CLOUD</h2>
            <p className="text-slate-400 max-w-xl mb-16 text-2xl font-medium italic leading-relaxed">"Vuelca tu historial de Google Sheets o registra tu odómetro actual para iniciar el motor de análisis."</p>
            <div className="flex gap-8">
              <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all flex items-center gap-4 hover:-translate-y-1"><Upload size={24} /> Importar Datos</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-emerald-500 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-900 transition-all flex items-center gap-4 hover:-translate-y-1"><Plus size={24} /> Nuevo Repostaje</button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] p-16 w-full max-w-2xl text-center relative shadow-2xl">
            <button onClick={() => setShowImport(false)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 transition-colors"><X size={40} /></button>
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto mb-10">
              <Database size={40} />
            </div>
            <h3 className="text-4xl font-black italic uppercase mb-4 tracking-tighter">SINCRONIZACIÓN CLOUD</h3>
            <p className="text-slate-400 text-base mb-16 italic">Tus datos se guardarán de forma permanente en FuelMaster Cloud.</p>
            <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[3rem] p-20 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all group">
              <Upload className="mx-auto mb-8 text-slate-100 group-hover:text-emerald-500 transition-colors" size={80} />
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-emerald-600">Haz clic para subir archivo .CSV</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <form onSubmit={handleAddEntry} className="bg-white rounded-[4rem] p-16 w-full max-w-xl relative shadow-2xl border-t-8 border-emerald-500">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 transition-colors"><X size={32} /></button>
            <div className="flex items-center gap-4 mb-12">
               <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><Fuel size={28} /></div>
               <h3 className="text-3xl font-black italic uppercase tracking-tighter">REGISTRO MANUAL</h3>
            </div>
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Fecha de Llenado</label>
                <input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Odómetro al finalizar (km)</label>
                <input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} placeholder="Ej: 115034" className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Total Litros</label>
                  <input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} placeholder="00.00" className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">PVP Gas. (€/L)</label>
                  <input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} placeholder="0.000" className="w-full bg-slate-50 py-6 px-10 rounded-3xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-7 rounded-[2.5rem] font-black uppercase tracking-widest mt-16 shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4">Sincronizar Repostaje <ChevronRight size={20}/></button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
