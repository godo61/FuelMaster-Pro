import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, 
  Database, Lock, Download, LogOut, Smartphone, ShieldCheck, 
  AlertCircle, Calendar, Sun, Moon, Mail, FileText, Globe, Settings, AlertTriangle, MapPin, Car, Info, BarChart3, Briefcase
} from 'lucide-react';
// Imports ajustados a la RAÍZ (sin src/)
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, VehicleProfile, VehicleCategory } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import { calculateNextITV } from './utils/itvLogic';
import { exportToPDF } from './utils/pdfExport';
import { downloadCSV, generateCSV } from './utils/csvExport';
import { translations } from './utils/translations';
import StatCard from './components/StatCard';
import FuelChart from './components/FuelChart';

const LOCAL_STORAGE_KEY = 'fuelmaster_entries';
const VEHICLE_KEY = 'fuelmaster_vehicle';
const THEME_KEY = 'fuelmaster_theme';
const LANG_KEY = 'fuelmaster_lang';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [calculatedEntries, setCalculatedEntries] = useState<CalculatedEntry[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // CAMBIO: Añadido 'tools' al tipo de estado
  const [view, setView] = useState<'dashboard' | 'history' | 'tools'>('dashboard');
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark');
  const [lang, setLang] = useState<'es' | 'en'>(() => (localStorage.getItem(LANG_KEY) as 'es' | 'en') || 'es');
  
  const [tripKm, setTripKm] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);

  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile | null>(() => {
    try {
      const saved = localStorage.getItem(VEHICLE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const t = translations[lang] || translations.es;

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAnnualStats, setShowAnnualStats] = useState(false);

  const [newEntryForm, setNewEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    kmFinal: '',
    fuelAmount: '',
    pricePerLiter: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lógica de Eco-Dashboard Dinámico
  const getEcoColor = () => {
    if (!stats) return 'emerald';
    const cons = stats.avgConsumption;
    if (cons < 4.8) return 'emerald'; // Excelente
    if (cons <= 5.5) return 'amber';   // Medio
    return 'orange';                  // Alto
  };

  const ecoColor = getEcoColor();
  const ecoBg = `bg-${ecoColor}-500`;
  const ecoText = `text-${ecoColor}-500`;
  const ecoBorder = `border-${ecoColor}-500`;
  const ecoShadow = `shadow-${ecoColor}-500/20`;

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    const initApp = async () => {
      try {
        if (isSupabaseConfigured) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            setSession(currentSession);
            await fetchUserData(currentSession.user.id);
          } else {
            loadLocalData();
          }
        } else {
          setIsLocalMode(true);
          loadLocalData();
        }
      } catch (e) {
        setIsLocalMode(true);
        loadLocalData();
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  const loadLocalData = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setEntries(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) { setEntries([]); }
  };

  const fetchUserData = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from('fuel_entries')
        .select('*')
        .eq('user_id', userId)
        .order('km_final', { ascending: true });
      
      if (!entriesError && entriesData) {
        const mapped: FuelEntry[] = entriesData.map(d => ({
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
      }

      const { data: profileData, error: profileError } = await supabase
        .from('vehicle_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profileError && profileData) {
        const profile: VehicleProfile = {
          registrationDate: profileData.registration_date,
          lastItvDate: profileData.last_itv_date,
          category: profileData.category as VehicleCategory,
          lastServiceKm: profileData.last_service_km,
          lastServiceDate: profileData.last_service_date
        };
        setVehicleProfile(profile);
        localStorage.setItem(VEHICLE_KEY, JSON.stringify(profile));
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
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } else {
      setCalculatedEntries([]);
      setStats(null);
    }
  }, [entries]);

  // --- CÁLCULO DE KM ANUALES (LÓGICA PROFESIONAL) ---
  const annualStats = useMemo(() => {
    if (!calculatedEntries.length) return { years: [], avgKm: 0, maxYearKm: 1 };

    const yearsMap: Record<number, number> = {};
    const currentYear = new Date().getFullYear();
    
    calculatedEntries.forEach(entry => {
      const [day, month, year] = entry.date.split('/').map(Number);
      if (year && !isNaN(year)) {
        yearsMap[year] = (yearsMap[year] || 0) + (entry.distancia || 0);
      }
    });

    const years = Object.keys(yearsMap)
      .map(Number)
      .sort((a, b) => b - a)
      .map(year => ({
        year,
        totalKm: yearsMap[year]
      }));

    const completedYears = years.filter(y => y.year < currentYear);

    let avgKm = 0;
    if (completedYears.length > 0) {
      const totalKmHistory = completedYears.reduce((acc, curr) => acc + curr.totalKm, 0);
      avgKm = totalKmHistory / completedYears.length;
    } else {
      avgKm = years.length > 0 ? years[0].totalKm : 0;
    }

    const maxYearKm = Math.max(...years.map(y => y.totalKm), 1); 

    return { years, avgKm, maxYearKm };
  }, [calculatedEntries]);

  const handleSaveVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profile: VehicleProfile = {
      registrationDate: formData.get('regDate') as string,
      lastItvDate: formData.get('lastItv') as string || undefined,
      category: formData.get('category') as VehicleCategory,
      lastServiceKm: Number(formData.get('lastServiceKm')) || undefined,
      lastServiceDate: formData.get('lastServiceDate') as string || undefined
    };

    setVehicleProfile(profile);
    localStorage.setItem(VEHICLE_KEY, JSON.stringify(profile));

    if (session?.user?.id && isSupabaseConfigured) {
      try {
        await supabase.from('vehicle_profiles').upsert({
          user_id: session.user.id,
          registration_date: profile.registrationDate,
          last_itv_date: profile.lastItvDate,
          category: profile.category,
          last_service_km: profile.lastServiceKm,
          last_service_date: profile.lastServiceDate
        });
      } catch (err) { }
    }
    
    setShowHelp(false);
  };

  const deleteEntry = async (id: string) => {
    if (!confirm(String(t.confirmDelete))) return;
    
    if (session?.user?.id && isSupabaseConfigured) {
      try {
        await supabase.from('fuel_entries').delete().eq('id', id);
      } catch (err) { }
    }
    
    setEntries(entries.filter(e => e.id !== id));
  };

  const handleBackupEmail = async (email: string) => {
    if (!email) return;
    const csvContent = generateCSV(calculatedEntries);
    const fileName = `FuelMaster_Backup_${new Date().toISOString().split('T')[0]}.csv`;
    const file = new File([csvContent], fileName, { type: 'text/csv' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'FuelMaster Pro Backup',
          text: 'Aquí tienes tu copia de seguridad de FuelMaster Pro.',
          files: [file]
        });
        setShowBackup(false);
        return; 
      } catch (err) { }
    }

    const subject = `FuelMaster Pro Backup - ${new Date().toLocaleDateString()}`;
    const body = `Hola,\n\nTu dispositivo no soporta adjuntos automáticos.\nAquí tienes los datos en texto plano:\n\n${csvContent}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowBackup(false);
  };

  const handleClearAllData = () => {
    if (confirm("⚠️ AVISO CRÍTICO ⚠️\n\n¿Estás seguro de que quieres BORRAR TODO?")) {
      if (confirm("¿Estás realmente seguro? Esta acción es irreversible.")) {
        localStorage.clear();
        setEntries([]);
        setVehicleProfile(null);
        window.location.reload();
      }
    }
  };

  const getNextService = () => {
    if (!vehicleProfile?.lastServiceKm || !vehicleProfile?.lastServiceDate || !stats) return null;
    
    const kmDrivenSinceService = Math.max(0, stats.lastOdometer - vehicleProfile.lastServiceKm);
    const rawKmRemaining = 15000 - kmDrivenSinceService;
    const kmRemaining = Math.min(15000, Math.max(0, rawKmRemaining));
    const kmPercent = Math.min((kmDrivenSinceService / 15000) * 100, 100);

    const lastDate = new Date(vehicleProfile.lastServiceDate);
    const nextDate = new Date(lastDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1); 
    
    const today = new Date();
    const totalTimeMs = nextDate.getTime() - lastDate.getTime();
    const elapsedTimeMs = today.getTime() - lastDate.getTime();
    const timePercent = Math.max(0, Math.min(100, (elapsedTimeMs / totalTimeMs) * 100));
    
    const daysRemaining = getDaysRemaining(nextDate.toISOString());
    const isTimeLimit = timePercent > kmPercent;
    const servicePercent = Math.max(kmPercent, timePercent);
    
    return {
      nextKm: vehicleProfile.lastServiceKm + 15000,
      nextDate,
      kmRemaining,
      daysRemaining,
      servicePercent,
      isTimeLimit,
      isUrgent: kmRemaining < 1000 || daysRemaining < 30
    };
  };

  const maintenance = getNextService();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 text-white">
        <RefreshCw className="text-emerald-500 animate-spin" size={48} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">Iniciando Sistema...</p>
      </div>
    );
  }

  if (!session && !isLocalMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="premium-card w-full max-w-md p-10 space-y-8 animate-fade-in shadow-2xl">
          <div className="text-center">
            <div className={`w-16 h-16 ${ecoBg} rounded-2xl flex items-center justify-center text-slate-950 mx-auto mb-6 transition-colors duration-1000`}>
              <Lock size={32} />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">{String(t.appTitle)}</h1>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsAuthLoading(true);
            try {
              const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
              if (error) throw error;
              window.location.reload();
            } catch (err: any) { setAuthError(err.message); } finally { setIsAuthLoading(false); }
          }} className="space-y-6">
            <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="EMAIL" className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-emerald-500" required />
            <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="PASSWORD" className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-emerald-500" required />
            {authError && <p className="text-red-500 text-[10px] font-bold uppercase text-center">{authError}</p>}
            <button type="submit" disabled={isAuthLoading} className={`w-full ${ecoBg} text-slate-950 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-colors duration-1000`}>{isAuthLoading ? '...' : String(t.enter)}</button>
          </form>
          <button onClick={() => setIsLocalMode(true)} className="w-full text-center text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-500">Modo Local (Sin Registro)</button>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO PRINCIPAL ---
  const itvDate = vehicleProfile ? calculateNextITV(vehicleProfile.registrationDate, vehicleProfile.category, vehicleProfile.lastItvDate) : null;
  const isItvValid = itvDate && !isNaN(itvDate.getTime());
  const itvDays = isItvValid ? getDaysRemaining(itvDate!.toISOString()) : 0;

  const getItvColorClass = (days: number) => {
    if (days <= 0) return 'text-red-600';
    if (days < 15) return 'text-red-500';
    if (days <= 30) return 'text-orange-500';
    return 'text-emerald-500';
  };

  const getItvBgClass = (days: number) => {
    if (days <= 0) return 'bg-red-500/10 border-red-500/20';
    if (days < 15) return 'bg-red-500/5 border-red-500/10';
    if (days <= 30) return 'bg-orange-500/10 border-orange-500/20';
    return 'bg-emerald-500/10 border-emerald-500/20';
  };

  const tripFuelEst = stats ? (Number(tripKm) / 100) * stats.avgConsumption : 0;
  const tripCostEst = stats ? (Number(tripKm) / 100) * stats.avgCostPer100Km : 0;
  
  const bestTripConsumption = calculatedEntries.length > 0 
    ? Math.min(...calculatedEntries.filter(e => e.consumption > 0).map(e => e.consumption)) 
    : 0;
  
  const potentialSavings = stats && bestTripConsumption > 0 
    ? ((stats.avgConsumption - bestTripConsumption) * (Number(tripKm) / 100)) * stats.avgPricePerLiter
    : 0;

  const avgRefillLiters = stats && calculatedEntries.length > 0 ? stats.totalFuel / calculatedEntries.length : 0;
  const estimatedTypicalRange = stats && stats.avgConsumption > 0 ? (avgRefillLiters / stats.avgConsumption) * 100 : 0;
  const estimatedMaxPotentialRange = stats && stats.avgConsumption > 0 ? (43 / stats.avgConsumption) * 100 : 0;

  const carPosition = Math.min(Number(tripKm), 1000) / 1000 * 100;

  const trends = {
    consumption: calculatedEntries.map(e => e.consumption).filter(v => v > 0).slice(-5),
    efficiency: calculatedEntries.map(e => e.kmPerLiter).filter(v => v > 0).slice(-5),
    pvp: calculatedEntries.map(e => e.pricePerLiter).slice(-5),
    cost: calculatedEntries.map(e => e.cost).slice(-5),
    cost100: calculatedEntries.map(e => (e.cost / (e.distancia || 1)) * 100).filter(v => v > 0 && v < 50).slice(-5),
    liters: calculatedEntries.map(e => e.fuelAmount).slice(-5),
    odometer: calculatedEntries.map(e => e.kmFinal).slice(-5)
  };

  return (
    <div className={`min-h-screen pb-20 ${theme === 'light' ? 'light' : ''}`}>
      <nav className="h-24 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 flex items-center px-6 sm:px-10 sticky top-0 z-[60]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${ecoBg} rounded-xl flex items-center justify-center text-slate-900 rotate-2 transition-colors duration-1000`}>
              <Zap size={20} fill="currentColor" />
            </div>
            <h1 className="text-lg sm:text-xl font-black italic tracking-tighter uppercase leading-none text-white hidden xs:block">{String(t.appTitle)}</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 nav-actions">
            <div className="flex bg-slate-800/20 p-1 rounded-xl">
              <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="p-2 text-slate-400 hover:text-white transition-all flex items-center gap-1">
                <Globe size={16} />
                <span className="text-[8px] font-black uppercase">{lang}</span>
              </button>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 text-slate-400 hover:text-white transition-all">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>

            <div className="bg-slate-800/20 p-1 rounded-xl flex">
              <button onClick={() => setView('dashboard')} className={`px-3 sm:px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all duration-500 ${view === 'dashboard' ? `${ecoBg} text-slate-950` : 'text-slate-500'}`}>{String(t.monitor)}</button>
              <button onClick={() => setView('history')} className={`px-3 sm:px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all duration-500 ${view === 'history' ? `${ecoBg} text-slate-950` : 'text-slate-500'}`}>{String(t.history)}</button>
              {/* NUEVO BOTÓN: HERRAMIENTAS */}
              <button onClick={() => setView('tools')} className={`px-3 sm:px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all duration-500 flex items-center gap-1 ${view === 'tools' ? `${ecoBg} text-slate-950` : 'text-slate-500'}`}>
                <Briefcase size={12} /> HERRAMIENTAS
              </button>
            </div>
            
            <button onClick={() => setShowHelp(true)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:bg-white/5 rounded-xl"><Settings size={18}/></button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white"><LogOut size={18} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 animate-fade-in">
        {stats ? (
          <div className="space-y-10">
            {/* LAS TARJETAS DE ESTADÍSTICAS SIEMPRE VISIBLES */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              <StatCard label={String(t.consumption)} value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20}/>} color="bg-blue-500" trendData={trends.consumption} />
              <StatCard label={String(t.efficiency)} value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20}/>} color="bg-emerald-500" trendData={trends.efficiency} />
              <StatCard label={String(t.avgPvp)} value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20}/>} color="bg-amber-500" trendData={trends.pvp} />
              <StatCard label={String(t.totalCost)} value={stats.totalCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })} unit="€" icon={<Database size={20}/>} color="bg-violet-500" trendData={trends.cost} />
              <StatCard label={String(t.cost100)} value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20}/>} color="bg-rose-500" trendData={trends.cost100} />
              <StatCard label={String(t.liters)} value={stats.totalFuel.toFixed(0)} unit="L" icon={<Fuel size={20}/>} color="bg-indigo-500" trendData={trends.liters} />
              <StatCard label={String(t.odometer)} value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20}/>} color="bg-slate-500" trendData={trends.odometer} />
            </div>

            {/* VISTA 1: DASHBOARD (Monitor) */}
            {view === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-3 space-y-10">
                  <div className="premium-card p-6 sm:p-10"><FuelChart data={calculatedEntries} type="consumption" /></div>
                  <div className="premium-card p-6 sm:p-10"><FuelChart data={calculatedEntries} type="efficiency" /></div>
                </div>
                <div className="space-y-6">
                  {/* WIDGET AUTONOMÍA INTELIGENTE */}
                  <div className="premium-card p-6 border-l-4 border-indigo-500 flex flex-col gap-4">
                    <h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-white">
                      <Fuel size={14} className="text-indigo-500" /> {String(t.theoreticalRange)}
                    </h3>
                    <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col items-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">{String(t.fullTankRange)}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black font-mono-prec text-white group-hover:text-indigo-400 transition-colors">{estimatedTypicalRange.toFixed(0)}</span>
                        <span className="text-[10px] font-bold text-indigo-400">KM</span>
                      </div>
                      
                      <div className="w-full h-2 bg-slate-900/50 rounded-full mt-5 overflow-hidden border border-white/5 relative">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-1000 ease-out" 
                          style={{ width: `${Math.min((avgRefillLiters / 43) * 100, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="w-full grid grid-cols-2 mt-4 px-1 gap-4">
                        <div className="flex flex-col">
                           <span className="text-[7px] text-slate-500 uppercase font-black mb-1">Tu Repostaje Medio</span>
                           <span className="text-[10px] text-indigo-300 font-bold font-mono-prec">{avgRefillLiters.toFixed(1)} <span className="text-[7px] font-sans">L</span></span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[7px] text-slate-500 uppercase font-black mb-1">{String(t.maxPotential)}</span>
                           <span className="text-[10px] text-slate-400 font-bold font-mono-prec">{estimatedMaxPotentialRange.toFixed(0)} <span className="text-[7px] font-sans">KM</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CALCULADORA DE TRAYECTO */}
                  <div className={`premium-card p-6 border-l-4 ${ecoBorder} flex flex-col gap-4 transition-colors duration-1000`}>
                    <h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-white">
                      <MapPin size={14} className={ecoText} /> {String(t.tripCalculator)}
                    </h3>
                    
                    <div className="relative h-8 w-full bg-slate-900/50 rounded-lg border border-white/5 overflow-hidden flex items-center px-4">
                      <div className="absolute left-0 h-[1px] w-full border-t border-dashed border-slate-700/50"></div>
                      <div 
                        className="relative z-10 transition-all duration-500 ease-out"
                        style={{ transform: `translateX(calc(${carPosition}% - 24px))` }}
                      >
                        <Car size={18} className={`${ecoText} drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <input 
                          type="number" 
                          placeholder={String(t.tripDistance)}
                          value={tripKm}
                          onChange={(e) => setTripKm(e.target.value)}
                          className={`w-full bg-slate-900 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:border-${ecoColor}-500 transition-all font-mono-prec`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">KM</span>
                      </div>
                      
                      {tripKm && stats && (
                        <>
                          <div className="grid grid-cols-2 gap-2 animate-fade-in">
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                              <p className="text-[7px] font-black text-slate-500 uppercase mb-1">{String(t.estFuel)}</p>
                              <p className={`text-sm font-black ${ecoText} font-mono-prec`}>{tripFuelEst.toFixed(1)} <span className="text-[8px] font-sans">L</span></p>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                              <p className="text-[7px] font-black text-slate-500 uppercase mb-1">{String(t.estCost)}</p>
                              <p className="text-sm font-black text-white font-mono-prec">{tripCostEst.toFixed(2)} <span className="text-[8px] font-sans">€</span></p>
                            </div>
                          </div>

                          {showComparison && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 animate-fade-in overflow-hidden relative group">
                                <div className={`absolute top-0 left-0 w-1 h-full ${ecoBg}`}></div>
                                <div className="flex justify-between items-start">
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Récord Histórico</p>
                                      <p className={`text-sm font-black ${ecoText} font-mono-prec`}>{bestTripConsumption.toFixed(2)} <span className="text-[8px] font-sans">L/100</span></p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Ahorro Potencial</p>
                                      <p className="text-sm font-black text-emerald-500 font-mono-prec">{potentialSavings.toFixed(2)} <span className="text-[8px] font-sans">€</span></p>
                                   </div>
                                </div>
                                <p className="text-[7px] text-slate-500 font-bold uppercase italic leading-tight">Si conduces hoy como en tu mejor viaje, ahorrarás el equivalente a {(potentialSavings / stats.avgPricePerLiter).toFixed(1)} litros.</p>
                            </div>
                          )}

                          <button 
                            onClick={() => setShowComparison(!showComparison)}
                            className={`w-full py-3 bg-${ecoColor}-500/10 hover:bg-${ecoColor}-500/20 ${ecoText} text-[8px] font-black uppercase rounded-lg border ${ecoBorder}/20 transition-all flex items-center justify-center gap-2`}
                          >
                            <TrendingUp size={12} /> {showComparison ? "Ocultar comparativa" : "Comparar con mi mejor viaje"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* PERFIL Y MANTENIMIENTO */}
                  <div className="premium-card p-6 border-l-4 border-blue-500 flex flex-col gap-6">
                    <h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-white">
                      <Settings size={14} className="text-blue-500" /> {String(t.vehicleProfile)}
                    </h3>
                    
                    <div className="space-y-4">
                      {isItvValid && (
                        <div className={`p-4 rounded-xl border transition-all ${getItvBgClass(itvDays)}`}>
                           <p className="text-[8px] font-bold text-slate-500 uppercase">{String(t.itvRemaining)}</p>
                           <div className="flex items-center gap-3">
                             <p className={`text-2xl font-black font-mono-prec ${getItvColorClass(itvDays)}`}>{itvDays}</p>
                             {itvDays <= 30 && <AlertCircle size={16} className={getItvColorClass(itvDays)} />}
                           </div>
                           <p className="text-[8px] font-black uppercase text-slate-500">Vencimiento: {itvDate?.toLocaleDateString()}</p>
                        </div>
                      )}

                      {maintenance ? (
                        <div className={`p-4 rounded-xl border transition-all ${maintenance.isUrgent ? 'bg-orange-500/10 border-orange-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                          
                          <div className="flex justify-between items-start mb-3">
                            <p className="text-[8px] font-bold text-slate-500 uppercase">Próxima Revisión</p>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Fecha Límite</p>
                                <p className="text-[10px] font-black text-white">{maintenance.nextDate.toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <div className="w-full h-3 bg-slate-900/50 rounded-full mb-4 overflow-hidden border border-white/5 relative">
                             <div 
                                className={`h-full transition-all duration-1000 ease-out ${maintenance.isUrgent ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]'}`}
                                style={{ width: `${maintenance.servicePercent}%` }}
                             ></div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className={`p-2 rounded-lg border ${!maintenance.isTimeLimit ? 'bg-slate-800/50 border-white/10' : 'bg-slate-900/30 border-transparent'}`}>
                                <p className="text-[7px] text-slate-500 uppercase font-bold mb-1">Distancia</p>
                                <p className={`text-lg font-black font-mono-prec ${!maintenance.isTimeLimit ? (maintenance.isUrgent ? 'text-orange-500' : 'text-blue-400') : 'text-slate-300'}`}>
                                    {maintenance.kmRemaining.toLocaleString()}
                                    <span className="text-[8px] font-sans text-slate-500 ml-1">KM</span>
                                </p>
                            </div>

                            <div className={`p-2 rounded-lg border ${maintenance.isTimeLimit ? 'bg-slate-800/50 border-white/10' : 'bg-slate-900/30 border-transparent'}`}>
                                <p className="text-[7px] text-slate-500 uppercase font-bold mb-1">Tiempo</p>
                                <p className={`text-lg font-black font-mono-prec ${maintenance.isTimeLimit ? (maintenance.isUrgent ? 'text-orange-500' : 'text-blue-400') : 'text-slate-300'}`}>
                                    {maintenance.daysRemaining}
                                    <span className="text-[8px] font-sans text-slate-500 ml-1">DÍAS</span>
                                </p>
                            </div>
                          </div>
                          
                          <p className="text-[8px] text-slate-500 uppercase font-black text-center mt-3">
                              {maintenance.servicePercent.toFixed(0)}% de vida útil consumida
                          </p>

                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-900 border border-white/5">
                           <p className="text-[8px] font-black text-slate-500 uppercase text-center">Configura tu mantenimiento en ajustes</p>
                        </div>
                      )}

                      <button 
                        onClick={() => setShowHelp(true)}
                        className="w-full mt-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase rounded-lg border border-blue-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Settings size={12} /> Gestionar Perfil
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 2: HISTORIAL (Tablas) */}
            {view === 'history' && (
              <div className="premium-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50 text-[9px] font-black uppercase text-slate-500">
                    <tr><th className="px-8 py-6">{String(t.date)}</th><th className="px-8 py-6 text-right">Odómetro</th><th className="px-8 py-6 text-right text-emerald-500">L/100km</th><th className="px-8 py-6 text-right">#</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {calculatedEntries.slice().reverse().map(e => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6 text-sm font-bold">{e.date}</td>
                        <td className="px-8 py-6 text-right text-sm font-bold text-slate-400 font-mono-prec">{e.kmFinal.toLocaleString()}</td>
                        <td className="px-8 py-6 text-right text-base font-black text-emerald-500 font-mono-prec">{e.consumption.toFixed(2)}</td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={() => deleteEntry(e.id)} className="text-red-500 opacity-50 hover:opacity-100 transition-all hover:scale-125"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISTA 3: HERRAMIENTAS (NUEVO PANEL DE CONTROL) */}
            {view === 'tools' && (
              <div className="max-w-4xl mx-auto animate-fade-in">
                <div className="text-center mb-10">
                  <h2 className="text-2xl font-black italic uppercase text-white mb-2">Panel de Gestión</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Importación, Exportación y Copias de Seguridad</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tarjeta 1: Importar */}
                  <button onClick={() => setShowImport(true)} className="group bg-slate-900/50 border border-white/5 hover:border-emerald-500/50 p-8 rounded-2xl text-left transition-all hover:bg-slate-900 shadow-xl">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Upload size={24} />
                    </div>
                    <h3 className="text-lg font-black uppercase text-white mb-2">Importar Datos</h3>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">Carga un archivo CSV existente para actualizar tu historial de repostajes.</p>
                  </button>

                  {/* Tarjeta 2: Exportar */}
                  <button onClick={() => downloadCSV(calculatedEntries, 'FuelMaster_Backup.csv')} className="group bg-slate-900/50 border border-white/5 hover:border-blue-500/50 p-8 rounded-2xl text-left transition-all hover:bg-slate-900 shadow-xl">
                    <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <h3 className="text-lg font-black uppercase text-white mb-2">Exportar CSV</h3>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">Descarga tus datos crudos en formato CSV para usarlos en Excel.</p>
                  </button>

                  {/* Tarjeta 3: PDF Report */}
                  <button onClick={() => exportToPDF(stats, calculatedEntries, vehicleProfile, maintenance)} className="group bg-slate-900/50 border border-white/5 hover:border-emerald-500/50 p-8 rounded-2xl text-left transition-all hover:bg-slate-900 shadow-xl">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Download size={24} />
                    </div>
                    <h3 className="text-lg font-black uppercase text-white mb-2">Reporte PDF Oficial</h3>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">Genera un documento profesional con estado del vehículo, mantenimiento e historial.</p>
                  </button>

                  {/* Tarjeta 4: Backup Email */}
                  <button onClick={() => setShowBackup(true)} className="group bg-slate-900/50 border border-white/5 hover:border-amber-500/50 p-8 rounded-2xl text-left transition-all hover:bg-slate-900 shadow-xl">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Mail size={24} />
                    </div>
                    <h3 className="text-lg font-black uppercase text-white mb-2">Backup por Email</h3>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">Envía una copia de seguridad completa adjunta a tu correo electrónico.</p>
                  </button>

                  {/* Tarjeta 5: Reporte Anual */}
                  <button onClick={() => setShowAnnualStats(true)} className="group bg-slate-900/50 border border-white/5 hover:border-violet-500/50 p-8 rounded-2xl text-left transition-all hover:bg-slate-900 shadow-xl md:col-span-2">
                    <div className="w-12 h-12 bg-violet-500/10 text-violet-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <BarChart3 size={24} />
                    </div>
                    <h3 className="text-lg font-black uppercase text-white mb-2">Analítica Anual</h3>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">Visualiza tu kilometraje desglosado por años y tu media histórica real.</p>
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] premium-card p-10 sm:p-20 text-center">
            <Database className="mb-8 text-slate-800 animate-pulse" size={64} />
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mb-10">No hay registros disponibles</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
              <button onClick={() => setShowImport(true)} className={`${ecoBg} text-slate-950 px-8 py-4 rounded-xl font-black uppercase text-[10px] w-full flex items-center justify-center gap-2 hover:scale-[1.05] transition-all duration-1000`}>
                <Upload size={14}/> {String(t.import)}
              </button>
              <button onClick={() => setShowNewEntry(true)} className="bg-slate-800 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] w-full flex items-center justify-center gap-2 hover:scale-[1.05] transition-all">
                <Plus size={14}/> {String(t.newEntry)}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODALES FLOTANTES */}
      <button onClick={() => setShowNewEntry(true)} className={`fixed bottom-6 right-6 sm:bottom-10 sm:right-10 w-14 h-14 sm:w-16 sm:h-16 ${ecoBg} text-slate-950 rounded-2xl shadow-2xl flex items-center justify-center z-[70] hover:scale-110 active:scale-95 transition-all duration-1000 ${ecoShadow}`}>
        <Plus size={28} />
      </button>

      {showAnnualStats && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-8 animate-fade-in">
          <div className="premium-card w-full max-w-2xl p-8 relative overflow-y-auto max-h-[90vh] shadow-2xl">
            <button onClick={() => setShowAnnualStats(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-all"><X size={32}/></button>
            
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-violet-500/20 text-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-500/20">
                <BarChart3 size={32} />
              </div>
              <h3 className="text-2xl font-black italic uppercase text-white">Reporte Anual</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Desglose de kilometraje por año</p>
            </div>

            <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6 mb-8 text-center">
               <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Media Anual Histórica</p>
               <p className="text-4xl font-black text-white font-mono-prec">
                 {annualStats.avgKm.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                 <span className="text-sm font-sans text-slate-500 ml-2">KM</span>
               </p>
            </div>

            <div className="space-y-4">
              {annualStats.years.map(({ year, totalKm }) => (
                <div key={year} className="group">
                  <div className="flex justify-between items-end mb-2 px-1">
                    <span className="text-sm font-black text-slate-300">{year}</span>
                    <span className="text-sm font-bold text-white font-mono-prec">{totalKm.toLocaleString()} <span className="text-[9px] text-slate-500">KM</span></span>
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                    <div 
                      className="h-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.4)] group-hover:bg-violet-400 transition-all duration-500"
                      style={{ width: `${(totalKm / annualStats.maxYearKm) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resto de modales (ShowHelp, ShowImport, ShowBackup, ShowNewEntry) se mantienen igual */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-8 animate-fade-in">
          <div className="premium-card w-full max-w-2xl p-8 relative overflow-y-auto max-h-[90vh] shadow-2xl">
            <button onClick={() => setShowHelp(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-all"><X size={32}/></button>
            <div className={`p-6 bg-${ecoColor}-500/5 rounded-3xl border ${ecoBorder}/10`}>
              <h3 className="text-2xl font-black italic uppercase text-white mb-8">Gestión de Perfil</h3>
              <form onSubmit={handleSaveVehicle} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Matriculación Inicial</label>
                      <input name="regDate" type="date" defaultValue={vehicleProfile?.registrationDate} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Última ITV Real</label>
                      <input name="lastItv" type="date" defaultValue={vehicleProfile?.lastItvDate} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" />
                   </div>
                </div>
                
                <div className="border-t border-white/5 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-blue-500 uppercase">Km de Última Revisión</label>
                      <input name="lastServiceKm" type="number" defaultValue={vehicleProfile?.lastServiceKm} placeholder="Ej: 112035" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono-prec" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-blue-500 uppercase">Fecha de Última Revisión</label>
                      <input name="lastServiceDate" type="date" defaultValue={vehicleProfile?.lastServiceDate} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-blue-500" />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase">Tipo de Vehículo</label>
                   <select name="category" defaultValue={vehicleProfile?.category || 'turismo'} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500 appearance-none">
                     <option value="turismo">Turismo Particular</option>
                     <option value="furgoneta">Furgoneta (≤3.5t)</option>
                     <option value="motocicleta">Motocicleta</option>
                   </select>
                </div>
                
                <button type="submit" className={`w-full py-5 ${ecoBg} text-slate-950 rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-lg ${ecoShadow} hover:scale-[1.02] transition-all duration-1000`}>Sincronizar Perfil</button>
              </form>

              <div className="mt-12 pt-8 border-t border-red-500/20 text-center">
                 <button onClick={handleClearAllData} className="text-red-500 font-black uppercase text-[10px] tracking-widest hover:text-red-400 transition-all">
                   Borrar base de datos local
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-8">
          <div className="premium-card w-full max-w-xl p-8 sm:p-12 relative shadow-2xl text-center">
            <button onClick={() => setShowImport(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-all"><X size={32}/></button>
            <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed border-slate-800 rounded-3xl p-10 sm:p-16 cursor-pointer hover:${ecoBorder}/50 transition-all group`}>
              <Upload className={`mx-auto mb-6 text-slate-500 group-hover:${ecoText} transition-colors`} size={56} />
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Sincronizar CSV</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => {
               const file = e.target.files?.[0];
               if(!file) return;
               const reader = new FileReader();
               reader.onload = async (evt) => {
                 try {
                   const parsed = parseFuelCSV(evt.target?.result as string);
                   setEntries(parsed);
                   setShowImport(false);
                 } catch(err) { alert("Error al procesar CSV."); }
               };
               reader.readAsText(file);
            }} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showBackup && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-8">
          <div className="premium-card w-full max-w-md p-8 sm:p-12 relative shadow-2xl text-center">
            <button onClick={() => setShowBackup(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-all"><X size={28}/></button>
            <Mail className="mx-auto mb-6 text-amber-500" size={48} />
            <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Email Backup</h3>
            <input id="backup-email-input" type="email" placeholder="tu@email.com" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-amber-500 text-sm font-bold mb-4" />
            <button onClick={() => handleBackupEmail((document.getElementById('backup-email-input') as HTMLInputElement).value)} className="w-full py-5 bg-amber-500 text-slate-950 rounded-xl font-black uppercase text-[10px] tracking-widest">Enviar Backup Ahora</button>
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-8">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const lit = Number(newEntryForm.fuelAmount);
            const pvp = Number(newEntryForm.pricePerLiter);
            const kf = Number(newEntryForm.kmFinal);
            const prev = calculatedEntries[calculatedEntries.length - 1];
            const ki = prev ? prev.kmFinal : kf - 500;
            const newE: FuelEntry = { 
              id: `en-${Date.now()}`, 
              date: newEntryForm.date.split('-').reverse().join('/'), 
              kmInicial: ki, 
              kmFinal: kf, 
              fuelAmount: lit, 
              pricePerLiter: pvp, 
              cost: lit * pvp, 
              distancia: kf - ki, 
              consumption: 0, 
              kmPerLiter: 0 
            };
            setEntries([...entries, newE]);
            setShowNewEntry(false);
          }} className="premium-card w-full max-w-lg p-8 sm:p-12 relative shadow-2xl">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-all"><X size={32}/></button>
            <h3 className="text-xl font-black italic uppercase mb-10 text-white flex items-center gap-3"><Fuel className={ecoText} /> Nuevo Reporte</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2"><label className="text-[9px] font-black text-slate-500 uppercase">Fecha</label><input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className={`w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-${ecoColor}-500`} required /></div>
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Km Actuales</label><input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} className={`w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-${ecoColor}-500`} required /></div>
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Litros</label><input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} className={`w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-${ecoColor}-500`} required /></div>
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Precio €/L</label><input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} className={`w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-${ecoColor}-500`} required /></div>
            </div>
            <button type="submit" className={`w-full ${ecoBg} text-slate-950 py-6 rounded-xl font-black uppercase tracking-widest mt-10 hover:scale-[1.02] transition-all duration-1000 shadow-lg ${ecoShadow}`}>Sincronizar Datos</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
