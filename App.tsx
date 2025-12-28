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
  const [isGuest, setIsGuest] = useState(false);
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

  // Carga inicial y Auth
  useEffect(() => {
    const initApp = async () => {
      // 1. Intentar cargar sesión si Supabase está configurado
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (data?.session) {
            setSession(data.session);
            await fetchUserData(data.session.user.id);
          }
        } catch (e) {
          console.warn("Error de conexión con Supabase (posible Failed to fetch):", e);
          // Si falla la conexión, permitimos que el usuario use el modo local
        }
      }

      // 2. Si no hay sesión, mirar localStorage
      const localData = localStorage.getItem('fuelmaster_local_entries');
      if (localData && !session) {
        try {
          setEntries(JSON.parse(localData));
          setIsGuest(true);
        } catch (e) {
          console.error("Error cargando datos locales:", e);
        }
      }

      setIsLoading(false);
    };

    initApp();

    if (isSupabaseConfigured) {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
          setSession(newSession);
          if (newSession) {
            setIsGuest(false);
            fetchUserData(newSession.user.id);
          }
        });
        return () => subscription.unsubscribe();
      } catch (e) {
        console.warn("No se pudo establecer el escuchador de Auth:", e);
      }
    }
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
      console.error("Error al obtener datos de Supabase:", e);
      alert("Error al sincronizar con la nube. Es posible que el servicio esté temporalmente inactivo.");
    }
  };

  useEffect(() => {
    if (entries.length > 0) {
      const calculated = calculateEntries(entries);
      setCalculatedEntries(calculated);
      setStats(getSummaryStats(calculated));
      
      // Guardar en local para persistencia inmediata
      if (isGuest || !session) {
        localStorage.setItem('fuelmaster_local_entries', JSON.stringify(entries));
      }
    } else {
      setCalculatedEntries([]);
      setStats(null);
    }
  }, [entries, isGuest, session]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = authMode === 'login' 
        ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        : await supabase.auth.signUp({ email: authEmail, password: authPassword });
      
      if (error) throw error;
    } catch (error: any) {
      const msg = error.message === 'Failed to fetch' 
        ? "No se pudo contactar con el servidor. Revisa tu conexión o usa el Modo Local."
        : error.message;
      alert("Error: " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = parseFuelCSV(event.target?.result as string);
        setIsSyncing(true);

        if (session) {
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
          setEntries(parsed);
          setIsGuest(true);
        }
        setShowImport(false);
      } catch (err: any) { 
        alert("Error: " + err.message); 
      } finally { 
        setIsSyncing(false); 
      }
    };
    reader.readAsText(file);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
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
        id: `local-${Date.now()}`,
        date: newEntryForm.date.split('-').reverse().join('/'),
        kmInicial: lastKm,
        kmFinal: kmFin,
        distancia: kmFin - lastKm,
        fuelAmount: liters,
        pricePerLiter: pvp,
        cost: cost,
        consumption: 0,
        kmPerLiter: 0
      };

      if (session) {
        const { error } = await supabase.from('fuel_entries').insert([{
          user_id: session.user.id,
          date: newEntryObj.date,
          km_inicial: newEntryObj.kmInicial,
          km_final: newEntryObj.kmFinal,
          fuel_amount: newEntryObj.fuelAmount,
          price_per_liter: newEntryObj.pricePerLiter,
          cost: newEntryObj.cost,
          distancia: newEntryObj.distancia
        }]);
        if (error) throw error;
        await fetchUserData(session.user.id);
      } else {
        setEntries([...entries, newEntryObj]);
        setIsGuest(true);
      }

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
    try {
      if (session) await supabase.auth.signOut();
    } catch (e) {
      console.warn("Error al cerrar sesión en Supabase:", e);
    }
    localStorage.removeItem('fuelmaster_local_entries');
    setEntries([]);
    setIsGuest(false);
    setSession(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <RefreshCw size={48} className="text-emerald-500 animate-spin" />
        <p className="text-emerald-500 font-black tracking-widest uppercase text-xs">Sincronizando Motores...</p>
      </div>
    );
  }

  if (!session && !isGuest && entries.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-xl bg-white rounded-[3.5rem] p-10 md:p-16 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
          
          <div className="flex flex-col items-center mb-12">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-emerald-500 mb-8 rotate-3 shadow-2xl">
              <Zap size={40} fill="currentColor" />
            </div>
            <h2 className="text-4xl font-black italic text-slate-900 leading-none uppercase tracking-tighter text-center">FuelMaster Pro</h2>
            <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.4em] mt-3">Toyota Hybrid Analytics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <button 
              onClick={() => setIsGuest(true)}
              className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-transparent hover:border-emerald-500 rounded-[2.5rem] transition-all group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm mb-4">
                <User size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-900">Modo Local</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Sin nube, datos privados</span>
            </button>
            <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-[2.5rem] transition-all">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm mb-4">
                <ShieldCheck size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-white">Seguridad Cloud</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase mt-1">Sincronización Total</span>
            </div>
          </div>

          <div className="relative py-4 mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-300 bg-white px-4">Acceso Usuarios</div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Email" required />
            <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-8 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Contraseña" required />
            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-emerald-600 transition-all">
              {authMode === 'login' ? 'Entrar al Panel' : 'Crear mi Cuenta'}
            </button>
          </form>

          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-8 text-[10px] font-black uppercase text-slate-400 hover:text-emerald-500 transition-colors">
            {authMode === 'login' ? '¿Eres nuevo? Regístrate aquí' : '¿Ya tienes cuenta? Entra aquí'}
          </button>
        </div>
      </div>
    );
  }

  const kmRemaining = stats ? serviceConfig.nextServiceKm - stats.lastOdometer : 0;
  const daysRemaining = getDaysRemaining(serviceConfig.nextServiceDate);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 font-sans">
      <button onClick={() => setShowNewEntry(true)} className="fixed bottom-10 right-10 z-[60] w-20 h-20 bg-slate-900 text-emerald-500 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-emerald-500/20"><Plus size={36} /></button>

      <nav className="h-28 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center px-10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 rotate-3 shadow-lg">
              <Zap size={28} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">FuelMaster Pro</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {session ? `Usuario: ${session.user.email}` : 'Sesión Local de Invitado'}
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex mr-4">
              <button onClick={() => setView('dashboard')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
              <button onClick={() => setView('history')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Historial</button>
            </div>
            <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3"><Upload size={16} /> Importar</button>
            <button onClick={handleLogout} className="bg-white text-slate-400 h-14 w-14 rounded-2xl border border-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all shadow-sm" title="Salir"><Trash2 size={22} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-10 py-12">
        {isSyncing && <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-10 py-4 rounded-full text-[10px] font-black uppercase animate-bounce shadow-2xl flex items-center gap-3 border-4 border-white"><RefreshCw size={16} className="animate-spin" /> Procesando Datos...</div>}

        {stats && stats.lastOdometer > 0 ? (
          <div className="space-y-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
              <StatCard label="Consumo" value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20} />} color="bg-blue-600" />
              <StatCard label="Eficiencia" value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20} />} color="bg-indigo-600" />
              <StatCard label="Media €/100" value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20} />} color="bg-rose-600" />
              <StatCard label="Media PVP" value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20} />} color="bg-amber-600" />
              <StatCard label="Combustible" value={stats.totalFuel.toFixed(1)} unit="L" icon={<Fuel size={20} />} color="bg-emerald-600" />
              <StatCard label="Kilometraje" value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20} />} color="bg-slate-600" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
                <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-slate-100 shadow-sm flex flex-col justify-between">
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

                <div className="lg:col-span-2 bg-white rounded-[3.5rem] p-10 md:p-16 text-slate-900 border border-slate-100 shadow-xl flex flex-col justify-center relative overflow-hidden">
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
                      {isGuest ? "Estás en Modo Local. " : "Datos sincronizados en la nube. "}
                      Rendimiento global: {stats.avgKmPerLiter.toFixed(2)} km/L.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                   <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-100 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-10 flex items-center gap-3"><Activity size={18} className="text-blue-500" /> Evolución Consumo</h4>
                      <FuelChart data={calculatedEntries} type="consumption" />
                   </div>
                   <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-100 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-10 flex items-center gap-3"><Zap size={18} className="text-emerald-500" /> Evolución Eficiencia</h4>
                      <FuelChart data={calculatedEntries} type="efficiency" />
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
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
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-[5rem] border-8 border-dashed border-slate-50 p-10 md:p-32">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-10">
              <Database size={64} />
            </div>
            <h2 className="text-4xl font-black italic uppercase text-slate-900 mb-6 tracking-tighter">SIN DATOS ACTIVOS</h2>
            <p className="text-slate-400 max-w-xl mb-16 text-xl font-medium italic">Sube tu CSV de FuelMaster para empezar el análisis en tiempo real.</p>
            <div className="flex flex-col sm:flex-row gap-6 md:gap-8">
              <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white px-12 md:px-16 py-6 md:py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4"><Upload size={24} /> Importar Datos</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-emerald-500 text-white px-12 md:px-16 py-6 md:py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-900 transition-all flex items-center justify-center gap-4"><Plus size={24} /> Nuevo Registro</button>
            </div>
          </div>
        )}
      </main>

      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-16 w-full max-w-2xl text-center relative shadow-2xl">
            <button onClick={() => setShowImport(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors"><X size={32} /></button>
            <h3 className="text-3xl font-black italic uppercase mb-12 tracking-tighter">CARGAR HISTORIAL CSV</h3>
            <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[3rem] p-16 md:p-20 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-all group">
              <Upload className="mx-auto mb-8 text-slate-100 group-hover:text-emerald-500 transition-colors" size={64} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pulsa para elegir archivo</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <form onSubmit={handleAddEntry} className="bg-white rounded-[3.5rem] p-10 md:p-16 w-full max-w-xl relative shadow-2xl border-t-8 border-emerald-500">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors"><X size={28} /></button>
            <h3 className="text-3xl font-black italic uppercase mb-12 tracking-tighter flex items-center gap-4"><Fuel className="text-emerald-500" /> NUEVA CARGA</h3>
            <div className="space-y-6 md:space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Fecha</label>
                <input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-50 py-5 px-8 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Odómetro (Km)</label>
                <input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} placeholder="Ej: 115034" className="w-full bg-slate-50 py-5 px-8 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Litros</label>
                  <input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} placeholder="00.00" className="w-full bg-slate-50 py-5 px-8 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Precio €/L</label>
                  <input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} placeholder="0.000" className="w-full bg-slate-50 py-5 px-8 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-lg" required />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-6 md:py-8 rounded-[2rem] font-black uppercase tracking-widest mt-12 shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4">Confirmar Repostaje <ChevronRight size={20}/></button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;