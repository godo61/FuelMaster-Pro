
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, 
  Database, Cloud, Lock, 
  Download, LayoutDashboard, History, LogOut, Key, Mail,
  AlertCircle, Smartphone, ChevronRight, Moon, Sun, Languages, Info, Send, ShieldCheck
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, ServiceConfig, VehicleProfile, VehicleCategory } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import { calculateNextITV } from './utils/itvLogic';
import { exportToPDF } from './utils/pdfExport';
import { downloadCSV } from './utils/csvExport';
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
  const [view, setView] = useState<'dashboard' | 'history'>('dashboard');
  
  // Vehicle Profile State
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile | null>(() => {
    const saved = localStorage.getItem(VEHICLE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  // Settings States
  const [theme, setTheme] = useState<'dark' | 'light'>(localStorage.getItem(THEME_KEY) as 'dark' | 'light' || 'dark');
  const [lang, setLang] = useState<'es' | 'en'>(localStorage.getItem(LANG_KEY) as 'es' | 'en' || 'es');
  const t = translations[lang];

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupEmail, setBackupEmail] = useState('');

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

  // Sync Theme
  useEffect(() => {
    if (theme === 'light') document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Sync Lang
  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    const initApp = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            setSession(currentSession);
            await fetchUserData(currentSession.user.id);
          } else {
            loadLocalData();
          }
        } catch (e) {
          loadLocalData();
        }
      } else {
        setIsLocalMode(true);
        loadLocalData();
      }
      setIsLoading(false);
    };
    initApp();
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
          km_final: Number(d.km_final),
          fuelAmount: Number(d.fuel_amount),
          pricePerLiter: Number(d.price_per_liter),
          cost: Number(d.cost),
          distancia: Number(d.distancia),
          kmFinal: Number(d.km_final),
          consumption: 0,
          kmPerLiter: 0
        }));
        setEntries(mapped);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
      }
    } catch (e) { loadLocalData(); }
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

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const toggleLang = () => setLang(lang === 'es' ? 'en' : 'es');

  const handleBackup = () => {
    if (!backupEmail) return;
    downloadCSV(calculatedEntries, `FuelMaster_Backup_${new Date().toISOString().slice(0,10)}.csv`);
    const subject = encodeURIComponent(`${t.appTitle} - Backup Data`);
    const body = encodeURIComponent(`Hola,\n\nAdjunto encontrarás el respaldo de mis datos de combustible de FuelMaster Pro.\n\nFecha: ${new Date().toLocaleDateString()}`);
    window.location.href = `mailto:${backupEmail}?subject=${subject}&body=${body}`;
    setShowBackupModal(false);
  };

  const handleSaveVehicle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profile: VehicleProfile = {
      registrationDate: formData.get('regDate') as string,
      category: formData.get('category') as VehicleCategory
    };
    setVehicleProfile(profile);
    localStorage.setItem(VEHICLE_KEY, JSON.stringify(profile));
    setShowHelp(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <RefreshCw className="text-emerald-500 animate-spin" size={48} />
        <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.5em]">System Syncing...</p>
      </div>
    );
  }

  if (!session && !isLocalMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="premium-card w-full max-w-md p-10 space-y-8 animate-fade-in shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 mx-auto mb-6 shadow-lg shadow-emerald-500/20">
              <Lock size={32} />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">{t.appTitle}</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">{t.cloudSync}</p>
          </div>
          <div className="flex justify-center gap-4">
            <button onClick={toggleLang} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase"><Languages size={14}/> {lang === 'es' ? 'EN' : 'ES'}</button>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsAuthLoading(true);
            try {
              if (authMode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
                if (error) throw error;
                window.location.reload();
              } else {
                const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
                if (error) throw error;
                alert("Check your email!");
              }
            } catch (err: any) { setAuthError(err.message); } finally { setIsAuthLoading(false); }
          }} className="space-y-6">
            {authError && <div className="bg-red-500/10 p-4 rounded-xl text-red-400 text-[10px] font-bold uppercase">{authError}</div>}
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="EMAIL" className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 pl-12 pr-6 text-sm font-bold text-white outline-none focus:border-emerald-500" required />
              </div>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="PASSWORD" className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 pl-12 pr-6 text-sm font-bold text-white outline-none focus:border-emerald-500" required />
              </div>
            </div>
            <button type="submit" disabled={isAuthLoading} className="w-full bg-emerald-500 text-slate-950 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400">{isAuthLoading ? '...' : (authMode === 'login' ? t.enter : t.register)}</button>
          </form>
          <button onClick={() => setIsLocalMode(true)} className="w-full text-center text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-500">{t.offlineMode}</button>
        </div>
      </div>
    );
  }

  // ITV Calculation for Dashboard
  const itvDate = vehicleProfile ? calculateNextITV(vehicleProfile.registrationDate, vehicleProfile.category) : null;
  const itvDays = itvDate ? getDaysRemaining(itvDate.toISOString()) : null;
  const itvColor = itvDays === null ? 'bg-slate-500' : itvDays < 7 ? 'bg-rose-500' : itvDays < 30 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen pb-20">
      <nav className="h-24 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 flex items-center px-10 sticky top-0 z-[60]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-900 rotate-2">
              <Zap size={24} fill="currentColor" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white">{t.appTitle}</h1>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-1">{isLocalMode ? t.offlineMode : t.cloudSync}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-800/20 p-1 rounded-xl flex">
              <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${view === 'dashboard' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'}`}>{t.monitor}</button>
              <button onClick={() => setView('history')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${view === 'history' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'}`}>{t.history}</button>
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
              <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-all">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
              <button onClick={toggleLang} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white font-black text-[10px]">{lang.toUpperCase()}</button>
              <button onClick={() => setShowHelp(true)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white"><Info size={18}/></button>
            </div>
            <button onClick={() => { supabase.auth.signOut(); window.location.reload(); }} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><LogOut size={18} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 animate-fade-in">
        {stats ? (
          <div className="space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <StatCard label={t.consumption} value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20}/>} color="bg-blue-500" />
              <StatCard label={t.efficiency} value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20}/>} color="bg-emerald-500" />
              <StatCard label={t.avgPvp} value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20}/>} color="bg-amber-500" />
              <StatCard label={t.cost100} value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20}/>} color="bg-rose-500" />
              <StatCard label={t.liters} value={stats.totalFuel.toFixed(0)} unit="L" icon={<Fuel size={20}/>} color="bg-indigo-500" />
              <StatCard label={t.odometer} value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20}/>} color="bg-slate-500" />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-3 space-y-10">
                  <div className="premium-card p-10"><FuelChart data={calculatedEntries} type="consumption" /></div>
                  <div className="premium-card p-10"><FuelChart data={calculatedEntries} type="efficiency" /></div>
                </div>
                <div className="space-y-6">
                  {/* ITV Alert Card */}
                  <div className="premium-card p-6 border-l-4 border-l-emerald-500">
                    <h3 className="text-[10px] font-black uppercase text-emerald-400 mb-6 flex items-center gap-2"><ShieldCheck size={14} /> {t.itvTitle}</h3>
                    {vehicleProfile ? (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-xl ${itvColor} bg-opacity-10`}>
                           <p className="text-[8px] font-bold text-slate-500 uppercase">{t.itvRemaining}</p>
                           <p className={`text-xl font-black ${itvDays! < 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {itvDays! < 0 ? t.itvExpired : itvDays === 27375 ? t.itvExempt : `${itvDays} ${t.estDays.split(' ')[0]}`}
                           </p>
                        </div>
                        <div className="bg-slate-900/40 p-4 rounded-xl">
                          <p className="text-[8px] font-bold text-slate-500 uppercase">{t.date}</p>
                          <p className="text-sm font-black">{itvDate?.toLocaleDateString()}</p>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowHelp(true)} className="w-full py-4 bg-slate-900 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">
                        Configurar ITV
                      </button>
                    )}
                  </div>

                  <div className="premium-card p-6">
                    <h3 className="text-[10px] font-black uppercase text-blue-400 mb-6 flex items-center gap-2"><Wrench size={14} /> {t.maintenance}</h3>
                    <div className="space-y-4">
                      <div className="bg-slate-900/40 p-4 rounded-xl">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">{t.remaining}</p>
                        <p className="text-xl font-black">{Math.max(0, serviceConfig.nextServiceKm - stats.lastOdometer).toLocaleString()} km</p>
                      </div>
                      <div className="bg-slate-900/40 p-4 rounded-xl">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">{t.estDays}</p>
                        <p className="text-xl font-black text-blue-400">{getDaysRemaining(serviceConfig.nextServiceDate)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => setShowImport(true)} className="w-full py-4 premium-card flex items-center justify-center gap-3 text-[10px] font-black uppercase hover:border-emerald-500 transition-all"><Upload size={14}/> {t.import}</button>
                    <button onClick={() => exportToPDF(stats, calculatedEntries)} className="w-full py-4 premium-card flex items-center justify-center gap-3 text-[10px] font-black uppercase hover:border-emerald-500 transition-all text-emerald-500"><Download size={14}/> {t.exportPdf}</button>
                    <button onClick={() => downloadCSV(calculatedEntries, 'FuelMaster_Export.csv')} className="w-full py-4 premium-card flex items-center justify-center gap-3 text-[10px] font-black uppercase hover:border-blue-500 transition-all text-blue-400"><Database size={14}/> {t.exportCsv}</button>
                    <button onClick={() => setShowBackupModal(true)} className="w-full py-4 premium-card flex items-center justify-center gap-3 text-[10px] font-black uppercase hover:border-amber-500 transition-all text-amber-500"><Mail size={14}/> {t.backup}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="premium-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-[9px] font-black uppercase text-slate-500">
                      <tr><th className="px-8 py-6">{t.date}</th><th className="px-8 py-6 text-right">{t.odometer}</th><th className="px-8 py-6 text-right text-emerald-500">L/100km</th><th className="px-8 py-6 text-right">#</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {calculatedEntries.slice().reverse().map(e => (
                        <tr key={e.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-8 py-6 text-sm font-bold">{e.date}</td>
                          <td className="px-8 py-6 text-right text-sm font-bold text-slate-400">{e.kmFinal.toLocaleString()}</td>
                          <td className="px-8 py-6 text-right text-base font-black text-emerald-500">{e.consumption.toFixed(2)}</td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => confirm(t.confirmDelete) && (isLocalMode ? setEntries(entries.filter(en => en.id !== e.id)) : supabase.from('fuel_entries').delete().eq('id', e.id).then(() => fetchUserData(session.user.id)))} className="text-red-500 opacity-50 hover:opacity-100"><Trash2 size={16}/></button>
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
          <div className="flex flex-col items-center justify-center min-h-[50vh] premium-card p-20">
            <Database className="mb-8 text-slate-800" size={64} />
            <h2 className="text-3xl font-black italic uppercase mb-8">{t.noData}</h2>
            <div className="flex gap-4">
              <button onClick={() => setShowImport(true)} className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-xl font-black uppercase text-[10px]">{t.import}</button>
              <button onClick={() => setShowNewEntry(true)} className="bg-slate-800 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px]">{t.newEntry}</button>
            </div>
          </div>
        )}
      </main>

      <button onClick={() => setShowNewEntry(true)} className="fixed bottom-10 right-10 w-16 h-16 bg-emerald-500 text-slate-950 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[70]">
        <Plus size={28} />
      </button>

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in">
          <div className="premium-card w-full max-w-md p-10 relative">
            <button onClick={() => setShowBackupModal(false)} className="absolute top-6 right-6 text-slate-500"><X size={24}/></button>
            <div className="flex flex-col items-center text-center">
              <Mail size={48} className="text-amber-500 mb-6" />
              <h3 className="text-xl font-black uppercase italic mb-2">{t.backupTitle}</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8">{t.backupDesc}</p>
              <input type="email" value={backupEmail} onChange={e => setBackupEmail(e.target.value)} placeholder={t.emailPlaceholder} className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-sm font-bold mb-6 outline-none focus:border-amber-500" />
              <button onClick={handleBackup} className="w-full py-4 bg-amber-500 text-slate-950 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-3"><Send size={14}/> {t.sendBackup}</button>
            </div>
          </div>
        </div>
      )}

      {/* Help & Vehicle Settings Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-fade-in overflow-y-auto">
          <div className="premium-card w-full max-w-2xl p-12 relative my-auto">
            <button onClick={() => setShowHelp(false)} className="absolute top-8 right-8 text-slate-500"><X size={32}/></button>
            <div className="space-y-8">
              {/* Vehicle Profile Form */}
              <div className="p-8 bg-emerald-500/5 rounded-3xl border border-emerald-500/10">
                <div className="flex items-center gap-4 mb-8">
                  <Smartphone size={32} className="text-emerald-500" />
                  <h3 className="text-2xl font-black italic uppercase">{t.vehicleProfile}</h3>
                </div>
                <form onSubmit={handleSaveVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase">{t.regDate}</label>
                      <input 
                        name="regDate" 
                        type="date" 
                        defaultValue={vehicleProfile?.registrationDate}
                        className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" 
                        required 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase">{t.vehicleType}</label>
                      <select 
                        name="category" 
                        defaultValue={vehicleProfile?.category || 'turismo'}
                        className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500 appearance-none"
                      >
                        <option value="turismo">{t.cat_turismo}</option>
                        <option value="motocicleta">{t.cat_motocicleta}</option>
                        <option value="ciclomotor">{t.cat_ciclomotor}</option>
                        <option value="furgoneta">{t.cat_furgoneta}</option>
                        <option value="pesado">{t.cat_pesado}</option>
                        <option value="autobus">{t.cat_autobus}</option>
                        <option value="caravana">{t.cat_caravana}</option>
                        <option value="historico">{t.cat_historico}</option>
                      </select>
                   </div>
                   <button type="submit" className="md:col-span-2 py-4 bg-emerald-500 text-slate-950 rounded-xl font-black uppercase text-[10px] tracking-widest mt-2">
                      {t.saveProfile}
                   </button>
                </form>
              </div>

              <div className="flex items-center gap-4">
                <Info size={32} className="text-emerald-500" />
                <h3 className="text-2xl font-black italic uppercase">{t.helpTitle}</h3>
              </div>
              <p className="text-sm font-medium text-slate-400 leading-relaxed">{t.helpWelcome}</p>
              <div className="space-y-6">
                <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                  <p className="text-xs font-bold text-white mb-2">{t.helpSection1}</p>
                </div>
                <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                  <p className="text-xs font-bold text-white mb-2">{t.helpSection2}</p>
                </div>
                <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5">
                  <p className="text-xs font-bold text-white mb-2">{t.helpSection3}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8">
          <div className="premium-card w-full max-w-xl p-12 relative">
            <button onClick={() => setShowImport(false)} className="absolute top-8 right-8 text-slate-500"><X size={32}/></button>
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-800 rounded-3xl p-16 text-center cursor-pointer hover:border-emerald-500/50 transition-all">
              <Upload className="mx-auto mb-6 text-slate-500" size={56} />
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">SUBIR CSV</p>
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => {
               const file = e.target.files?.[0];
               if(!file) return;
               const reader = new FileReader();
               reader.onload = async (evt) => {
                 try {
                   const parsed = parseFuelCSV(evt.target?.result as string);
                   if (isSupabaseConfigured && session && !isLocalMode) {
                     const db = parsed.map(p => ({ user_id: session.user.id, date: p.date, km_inicial: p.kmInicial, km_final: p.kmFinal, fuel_amount: p.fuelAmount, price_per_liter: p.pricePerLiter, cost: p.cost, distancia: p.distancia }));
                     await supabase.from('fuel_entries').insert(db);
                     fetchUserData(session.user.id);
                   } else {
                     setEntries([...entries, ...parsed]);
                   }
                   setShowImport(false);
                 } catch(e) { alert("CSV Error"); }
               };
               reader.readAsText(file);
            }} accept=".csv" className="hidden" />
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-8">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const lit = Number(newEntryForm.fuelAmount);
            const pvp = Number(newEntryForm.pricePerLiter);
            const kf = Number(newEntryForm.kmFinal);
            const prev = calculatedEntries[calculatedEntries.length - 1];
            const ki = prev ? prev.kmFinal : kf - 500;
            const newE: FuelEntry = { id: `en-${Date.now()}`, date: newEntryForm.date.split('-').reverse().join('/'), kmInicial: ki, kmFinal: kf, fuelAmount: lit, pricePerLiter: pvp, cost: lit * pvp, distancia: kf - ki, consumption: 0, kmPerLiter: 0 };
            
            if (!isLocalMode) {
              await supabase.from('fuel_entries').insert([{ user_id: session.user.id, date: newE.date, km_inicial: newE.kmInicial, km_final: newE.kmFinal, fuel_amount: newE.fuelAmount, price_per_liter: newE.pricePerLiter, cost: newE.cost, distancia: newE.distancia }]);
              fetchUserData(session.user.id);
            } else {
              setEntries([...entries, newE]);
            }
            setShowNewEntry(false);
          }} className="premium-card w-full max-w-lg p-12 relative border-t-4 border-emerald-500">
            <button type="button" onClick={() => setShowNewEntry(false)} className="absolute top-8 right-8 text-slate-500"><X size={32}/></button>
            <h3 className="text-xl font-black italic uppercase mb-10 flex items-center gap-3"><Fuel className="text-emerald-500" /> {t.newEntry}</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">{t.date}</label><input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required /></div>
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">{t.odometer}</label><input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} placeholder={t.odoTotal} className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required /></div>
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">{t.litersInput}</label><input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} placeholder="0.00" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required /></div>
              <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">{t.priceInput}</label><input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} placeholder="0.000" className="w-full bg-slate-900 border-none rounded-xl py-4 px-6 text-white outline-none focus:ring-1 focus:ring-emerald-500" required /></div>
            </div>
            <button type="submit" className="w-full bg-emerald-500 text-slate-950 py-6 rounded-xl font-black uppercase tracking-widest mt-10 hover:bg-emerald-400 transition-all">{t.syncData}</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
