
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Mail, Calendar, Settings, Trash2,
  Fuel, TrendingUp, ChevronRight, Save, Download, CheckCircle2, 
  AlertTriangle, LogOut, User, Lock, Cloud, Database, AlertCircle, ExternalLink
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, ServiceConfig } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import { getFuelInsights } from './services/geminiService';
import { downloadCSV } from './utils/csvExport';
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
  
  // Auth Form
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Modales
  const [showImport, setShowImport] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showServiceSettings, setShowServiceSettings] = useState(false);

  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({
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
        console.error("Auth error:", e);
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
      const { data: fuelData, error: fuelError } = await supabase
        .from('fuel_entries')
        .select('*')
        .eq('user_id', userId)
        .order('km_final', { ascending: true });

      if (fuelError) throw fuelError;
      
      if (fuelData) {
        setEntries(fuelData.map(d => ({
          ...d,
          fuelAmount: d.fuel_amount,
          pricePerLiter: d.price_per_liter,
          kmInicial: d.km_inicial,
          kmFinal: d.km_final
        })));
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.serviceConfig) {
        setServiceConfig(user.user_metadata.serviceConfig);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
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
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      let result;
      if (authMode === 'login') {
        result = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      } else {
        result = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      }
      if (result.error) throw result.error;
    } catch (error: any) {
      alert(error.message);
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
        alert("Sincronización masiva con FuelMaster-Pro completada.");
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
    const liters = Number(newEntryForm.fuelAmount);
    const pvp = Number(newEntryForm.pricePerLiter);
    const cost = liters * pvp;

    if (kmFin <= lastKm) {
      alert(`Odómetro inválido. Debe ser mayor a ${lastKm}`);
      return;
    }

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

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('fuel_entries').insert([newEntryObj]).select();
      if (error) throw error;

      const newEntry: FuelEntry = {
        id: data[0].id,
        date: newEntryObj.date,
        kmInicial: lastKm,
        kmFinal: kmFin,
        distancia: kmFin - lastKm,
        fuelAmount: liters,
        pricePerLiter: pvp,
        cost: cost,
        consumption: 0,
        kmPerLiter: 0
      };

      setEntries([...entries, newEntry]);
      setShowNewEntry(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const kmRemaining = stats ? serviceConfig.nextServiceKm - stats.lastOdometer : 0;
  const daysRemaining = getDaysRemaining(serviceConfig.nextServiceDate);

  // Pantalla de Configuración Faltante
  if (!isSupabaseConfigured && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-2xl bg-white rounded-[3rem] p-16 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <AlertCircle size={80} className="text-amber-500 mx-auto mb-8" />
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-none mb-4">CONEXIÓN REQUERIDA</h2>
          <p className="text-slate-500 text-lg mb-10 leading-relaxed">
            Para que <span className="font-bold text-emerald-600">FuelMaster-Pro</span> funcione, debes configurar las variables de entorno con tus credenciales de Supabase.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-12">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Paso 1</p>
              <p className="text-sm font-bold text-slate-800">Copia la URL y la llave Anon de Supabase (Settings > API).</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Paso 2</p>
              <p className="text-sm font-bold text-slate-800">Configura SUPABASE_URL y SUPABASE_ANON_KEY en tu hosting.</p>
            </div>
          </div>
          <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" className="inline-flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all shadow-xl">
            Ir a Supabase Dashboard <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black uppercase tracking-widest animate-pulse">Iniciando Ecosistema FuelMaster...</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl relative">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 mb-6 rotate-3">
              <Zap size={32} fill="currentColor" />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">FUELMASTER PRO</h2>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-2">Toyota C-HR Revolution</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Email</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="usuario@mail.com" required />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Contraseña</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-emerald-600 transition-all shadow-xl mt-6">
              {authMode === 'login' ? 'Acceder al Cloud' : 'Registrar Vehículo'}
            </button>
          </form>

          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500 transition-colors">
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-32">
      {/* Botón Flotante */}
      <button 
        onClick={() => setShowNewEntry(true)}
        className="fixed bottom-10 right-10 z-[60] w-20 h-20 bg-slate-900 text-emerald-500 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-emerald-500/20"
      >
        <Plus size={36} />
      </button>

      {/* MODAL: Nuevo Repostaje */}
      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <form onSubmit={handleAddEntry} className="bg-white w-full max-w-lg rounded-[3rem] p-12 shadow-2xl relative">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"><X size={28} /></button>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-3"><Fuel className="text-emerald-500" /> Registro Online</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Fecha</label>
                <input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none" required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Odómetro (Km)</label>
                <input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Litros</label>
                  <input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">PVP Gas. 95</label>
                  <input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold outline-none" required />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest mt-10 hover:bg-emerald-600 transition-all shadow-xl">Guardar en FuelMaster-Pro</button>
          </form>
        </div>
      )}

      {/* MODAL: Importar */}
      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-16 relative shadow-2xl">
            <button onClick={() => setShowImport(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-600"><X size={32} /></button>
            <h3 className="text-4xl font-black italic uppercase tracking-tighter mb-4">Sincronización Cloud</h3>
            <p className="text-slate-400 mb-12 text-sm italic">Tu histórico de Google Sheets se guardará de forma segura en FuelMaster-Pro.</p>
            <div 
              onClick={() => fileInputRef.current?.click()} 
              className="border-4 border-dashed border-slate-100 rounded-[3rem] p-16 hover:bg-emerald-50 cursor-pointer transition-all flex flex-col items-center group"
            >
              <Database className="text-slate-200 group-hover:text-emerald-500 transition-colors mb-6" size={64} />
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">Seleccionar CSV</p>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />

      {/* Nav */}
      <nav className="h-28 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center px-10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 shadow-xl rotate-3"><Zap size={28} fill="currentColor" /></div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter leading-none uppercase">FuelMaster Pro</h1>
              <div className="flex items-center gap-2 mt-1">
                <Cloud size={10} className="text-emerald-500" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Online: {session.user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-100 p-1 rounded-2xl flex mr-4">
              <button onClick={() => setView('dashboard')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Panel</button>
              <button onClick={() => setView('history')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Libro</button>
            </div>
            <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl">Importar</button>
            <button onClick={() => supabase.auth.signOut()} className="bg-slate-50 text-slate-400 h-12 w-12 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 border border-slate-100"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-16">
        {isSyncing && (
          <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce flex items-center gap-3 shadow-2xl">
            <RefreshCw size={14} className="animate-spin" /> Sincronizando Cloud...
          </div>
        )}

        {stats && stats.lastOdometer > 0 ? (
          <div className="space-y-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              <StatCard label="Consumo Real" value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20} />} color="bg-blue-600" />
              <StatCard label="Eficiencia" value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20} />} color="bg-indigo-600" />
              <StatCard label="Coste/100km" value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20} />} color="bg-rose-600" />
              <StatCard label="Media PVP" value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20} />} color="bg-amber-600" />
              <StatCard label="Total Litros" value={stats.totalFuel.toLocaleString('es-ES', {maximumFractionDigits: 1})} unit="L" icon={<Fuel size={20} />} color="bg-emerald-600" />
              <StatCard label="Odómetro" value={stats.lastOdometer.toLocaleString('es-ES')} unit="km" icon={<Navigation size={20} />} color="bg-slate-600" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[500px]">
                  <h3 className="font-black text-2xl italic uppercase tracking-tighter text-slate-800 flex items-center gap-3 mb-10"><Wrench size={24} className="text-emerald-500" /> Mantenimiento</h3>
                  <div className="space-y-8 flex-1">
                    <div className={`p-8 rounded-[2.5rem] relative overflow-hidden border ${kmRemaining < 500 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">Próxima Revisión <span>{serviceConfig.nextServiceKm.toLocaleString()} Km</span></p>
                      <p className={`text-4xl font-black tracking-tighter ${kmRemaining < 500 ? 'text-red-600' : 'text-slate-800'}`}>{Math.max(0, kmRemaining).toLocaleString('es-ES')} <span className="text-sm font-bold opacity-30 italic uppercase">km</span></p>
                    </div>
                    <div className={`p-8 rounded-[2.5rem] relative overflow-hidden border ${daysRemaining < 15 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">Fecha Límite <span>{serviceConfig.nextServiceDate.split('-').reverse().join('/')}</span></p>
                      <p className={`text-4xl font-black tracking-tighter ${daysRemaining < 15 ? 'text-amber-600' : 'text-blue-600'}`}>{daysRemaining} <span className="text-sm font-bold opacity-30 italic uppercase">días</span></p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-slate-950 rounded-[4rem] p-16 text-white relative overflow-hidden flex flex-col shadow-2xl">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-12">ANÁLISIS <span className="text-emerald-500">CLOUD</span></h2>
                  <div className="flex-1 bg-white/5 backdrop-blur-md rounded-[3rem] p-10 italic text-slate-200 text-xl leading-relaxed border-l-4 border-emerald-500/30">
                    Ecosistema FuelMaster-Pro sincronizado. Tienes {entries.length} registros protegidos. Tu consumo de {stats.avgConsumption.toFixed(2)} L/100km es un dato clave para optimizar la eficiencia de tu Toyota Revolution.
                  </div>
                </div>

                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm"><FuelChart data={calculatedEntries} type="consumption" /></div>
                   <div className="bg-white p-14 rounded-[4rem] border border-slate-100 shadow-sm"><FuelChart data={calculatedEntries} type="efficiency" /></div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] border border-slate-100 shadow-xl overflow-hidden animate-in slide-in-from-right-10 duration-500">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                    <tr>
                      <th className="px-12 py-10">Fecha</th>
                      <th className="px-12 py-10 text-right">Odómetro</th>
                      <th className="px-12 py-10 text-right">Llenado</th>
                      <th className="px-12 py-10 text-right">PVP (€/L)</th>
                      <th className="px-12 py-10 text-right text-emerald-600">L/100km</th>
                      <th className="px-12 py-10 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {calculatedEntries.slice().reverse().map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50 group transition-all">
                        <td className="px-12 py-8 text-sm font-black text-slate-700">{e.date}</td>
                        <td className="px-12 py-8 text-right text-sm font-bold text-slate-400">{e.kmFinal.toLocaleString('es-ES')}</td>
                        <td className="px-12 py-8 text-right text-sm font-medium">{e.fuelAmount.toFixed(2)} L</td>
                        <td className="px-12 py-8 text-right text-sm font-medium text-slate-500">{e.pricePerLiter.toFixed(3)}</td>
                        <td className="px-12 py-8 text-right text-sm font-black text-emerald-600">{e.consumption.toFixed(2)}</td>
                        <td className="px-12 py-8 text-right">
                           <button onClick={() => {if(confirm("¿Eliminar del cloud?")) setEntries(entries.filter(x => x.id !== e.id))}} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[75vh] text-center bg-white rounded-[5rem] border-8 border-dashed border-slate-50 p-32">
            <h2 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 mb-8 leading-none">Cloud Analytics</h2>
            <p className="text-slate-400 max-w-xl text-2xl font-medium leading-relaxed mb-16 italic">"Vuelca tus datos en FuelMaster-Pro para empezar el análisis masivo."</p>
            <div className="flex gap-6">
              <button onClick={() => setShowImport(true)} className="bg-slate-900 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all flex items-center gap-6"><Upload size={24} /> Importar Datos</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-emerald-500 text-white px-16 py-8 rounded-[2.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-900 transition-all flex items-center gap-6"><Plus size={24} /> Nuevo Registro</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
