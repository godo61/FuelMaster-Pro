import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, RefreshCw, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, 
  Database, Lock, Download, LogOut, Smartphone, ShieldCheck, 
  AlertCircle, Calendar, Sun, Moon, Mail, FileText, Globe, Settings, AlertTriangle, MapPin, Car, Info, BarChart3, Briefcase, Share2, LayoutDashboard, History, MessageSquare
} from 'lucide-react';

// --- IMPORTS ---
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, VehicleProfile, VehicleCategory } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import { calculateNextITV } from './utils/itvLogic';
import { exportToPDF, smartShareReport, shareTextReport } from './utils/pdfExport';
import { downloadCSV, shareCSV } from './utils/csvExport';
import { translations } from './utils/translations';
import StatCard from './components/StatCard';
import FuelChart from './components/FuelChart';

const LOCAL_STORAGE_KEY = 'fuelmaster_entries';
const VEHICLE_KEY = 'fuelmaster_vehicle';
const THEME_KEY = 'fuelmaster_theme';
const LANG_KEY = 'fuelmaster_lang';

type ViewType = 'stats' | 'dashboard' | 'history' | 'tools';

// --- DICCIONARIO UI LOCAL EXTENDIDO (Para cubrir TODAS las traducciones faltantes) ---
const uiText = {
  es: {
    // Tools View
    toolsTitle: "Panel de Gestión",
    toolsDesc: "Importación, Exportación y Backups",
    importData: "Importar Datos",
    importDesc: "Cargar archivo CSV",
    exportCsv: "Exportar CSV",
    exportCsvDesc: "Descargar datos crudos",
    reportPdf: "Reporte PDF",
    reportPdfDesc: "Documento oficial",
    sharePdf: "Compartir PDF",
    sharePdfDesc: "Enviar vía apps",
    shareText: "Resumen Texto",
    shareTextDesc: "Para WhatsApp",
    backupEmail: "Backup Email",
    backupDesc: "Enviar copia segura",
    annualStats: "Analítica Anual",
    annualDesc: "Desglose por años",
    // Dashboard Cards
    nextService: "Próxima Revisión",
    deadline: "Fecha Límite",
    distance: "Distancia",
    time: "Tiempo",
    days: "DÍAS",
    lifeConsumed: "vida útil consumida",
    manageProfile: "Gestionar Perfil",
    configMaint: "Configura tu mantenimiento",
    compare: "Comparar",
    hide: "Ocultar",
    // Modals
    newReportTitle: "Nuevo Reporte",
    date: "Fecha",
    currentKm: "Km Actuales",
    liters: "Litros",
    price: "Precio €/L",
    save: "Guardar",
    settingsTitle: "Ajustes & Perfil",
    registration: "Matriculación",
    lastItv: "Última ITV",
    serviceKm: "Km Revisión",
    serviceDate: "Fecha Revisión",
    vehicleType: "Tipo Vehículo",
    saveChanges: "Guardar Cambios",
    deleteAll: "Borrar todos los datos",
    // Bottom Nav
    navStats: "Resumen",
    navDash: "Gráficos",
    navHist: "Historial",
    navTools: "Gestión"
  },
  en: {
    // Tools View
    toolsTitle: "Management Panel",
    toolsDesc: "Import, Export & Backups",
    importData: "Import Data",
    importDesc: "Load CSV file",
    exportCsv: "Export CSV",
    exportCsvDesc: "Download raw data",
    reportPdf: "PDF Report",
    reportPdfDesc: "Official document",
    sharePdf: "Share PDF",
    sharePdfDesc: "Send via apps",
    shareText: "Text Summary",
    shareTextDesc: "For WhatsApp",
    backupEmail: "Email Backup",
    backupDesc: "Send secure copy",
    annualStats: "Annual Analytics",
    annualDesc: "Yearly breakdown",
    // Dashboard Cards
    nextService: "Next Service",
    deadline: "Deadline",
    distance: "Distance",
    time: "Time",
    days: "DAYS",
    lifeConsumed: "lifespan consumed",
    manageProfile: "Manage Profile",
    configMaint: "Configure maintenance",
    compare: "Compare",
    hide: "Hide",
    // Modals
    newReportTitle: "New Entry",
    date: "Date",
    currentKm: "Current Odometer",
    liters: "Liters",
    price: "Price €/L",
    save: "Save",
    settingsTitle: "Settings & Profile",
    registration: "Registration Date",
    lastItv: "Last MOT/ITV",
    serviceKm: "Service Km",
    serviceDate: "Service Date",
    vehicleType: "Vehicle Type",
    saveChanges: "Save Changes",
    deleteAll: "Delete All Data",
    // Bottom Nav
    navStats: "Summary",
    navDash: "Charts",
    navHist: "History",
    navTools: "Tools"
  }
};

// ==========================================
// 1. COMPONENTE INTERNO: BARRA DE NAVEGACIÓN
// ==========================================
const BottomNavInternal = ({ activeView, onNavigate, lang }: { activeView: ViewType, onNavigate: (v: ViewType) => void, lang: 'es'|'en' }) => {
  const txt = uiText[lang];
  const navItems = [
    { id: 'stats', label: txt.navStats, icon: <BarChart3 size={20} /> },
    { id: 'dashboard', label: txt.navDash, icon: <LayoutDashboard size={20} /> },
    { id: 'history', label: txt.navHist, icon: <History size={20} /> },
    { id: 'tools', label: txt.navTools, icon: <Briefcase size={20} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 pb-safe safe-area-pb">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewType)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${
                isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {isActive && <span className="absolute top-0 w-8 h-0.5 bg-emerald-500 rounded-b-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : ''}`}>{item.icon}</div>
              <span className={`text-[9px] font-black uppercase tracking-wide transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 2. COMPONENTE INTERNO: VISTA RESUMEN
// ==========================================
const StatsViewInternal = ({ stats, trends, t }: any) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
    <StatCard label={String(t.consumption)} value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20}/>} color="bg-blue-500" trendData={trends.consumption} />
    <StatCard label={String(t.efficiency)} value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20}/>} color="bg-emerald-500" trendData={trends.efficiency} />
    <StatCard label={String(t.avgPvp)} value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20}/>} color="bg-amber-500" trendData={trends.pvp} />
    <StatCard label={String(t.totalCost)} value={stats.totalCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })} unit="€" icon={<Database size={20}/>} color="bg-violet-500" trendData={trends.cost} />
    <StatCard label={String(t.cost100)} value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20}/>} color="bg-rose-500" trendData={trends.cost100} />
    <StatCard label={String(t.liters)} value={stats.totalFuel.toFixed(0)} unit="L" icon={<Fuel size={20}/>} color="bg-indigo-500" trendData={trends.liters} />
    <StatCard label={String(t.odometer)} value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20}/>} color="bg-slate-500" trendData={trends.odometer} />
  </div>
);

// ==========================================
// 3. COMPONENTE INTERNO: VISTA HISTORIAL
// ==========================================
const HistoryViewInternal = ({ entries, onDelete, t }: any) => (
  <div className="premium-card overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
    <table className="w-full text-left">
      <thead className="bg-slate-900/50 text-[9px] font-black uppercase text-slate-500">
        <tr><th className="px-6 py-4">{String(t.date)}</th><th className="px-6 py-4 text-right">Odo.</th><th className="px-6 py-4 text-right text-emerald-500">L/100</th><th className="px-6 py-4 text-right">#</th></tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {entries.slice().reverse().map((e: any) => (
          <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
            <td className="px-6 py-4 text-xs font-bold text-white">{e.date}</td>
            <td className="px-6 py-4 text-right text-xs font-bold text-slate-400 font-mono-prec">{e.kmFinal.toLocaleString()}</td>
            <td className="px-6 py-4 text-right text-sm font-black text-emerald-500 font-mono-prec">{e.consumption.toFixed(2)}</td>
            <td className="px-6 py-4 text-right"><button onClick={() => onDelete(e.id)} className="text-red-500 opacity-50 hover:opacity-100"><Trash2 size={14}/></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ==========================================
// 4. COMPONENTE INTERNO: VISTA HERRAMIENTAS
// ==========================================
const ToolsViewInternal = ({ onImport, onExportCSV, onExportPDF, onBackupEmail, onAnnualStats, lang }: any) => {
  const txt = uiText[lang as 'es'|'en'] || uiText.es;
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="text-center mb-6"><h2 className="text-xl font-black italic uppercase text-white">{txt.toolsTitle}</h2><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{txt.toolsDesc}</p></div>
      <button onClick={onImport} className="flex items-center gap-4 bg-slate-900/50 border border-white/5 hover:border-emerald-500/50 p-5 rounded-2xl w-full text-left transition-all"><div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center"><Upload size={20} /></div><div><h3 className="font-bold text-white text-sm">{txt.importData}</h3><p className="text-[10px] text-slate-500">{txt.importDesc}</p></div></button>
      <button onClick={onExportCSV} className="flex items-center gap-4 bg-slate-900/50 border border-white/5 hover:border-blue-500/50 p-5 rounded-2xl w-full text-left transition-all"><div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center"><FileText size={20} /></div><div><h3 className="font-bold text-white text-sm">{txt.exportCsv}</h3><p className="text-[10px] text-slate-500">{txt.exportCsvDesc}</p></div></button>
      <button onClick={onExportPDF} className="flex items-center gap-4 bg-slate-900/50 border border-white/5 hover:border-violet-500/50 p-5 rounded-2xl w-full text-left transition-all"><div className="w-10 h-10 bg-violet-500/10 text-violet-500 rounded-xl flex items-center justify-center"><Download size={20} /></div><div><h3 className="font-bold text-white text-sm">{txt.reportPdf}</h3><p className="text-[10px] text-slate-500">{txt.reportPdfDesc}</p></div></button>
      <button onClick={onBackupEmail} className="flex items-center gap-4 bg-slate-900/50 border border-white/5 hover:border-amber-500/50 p-5 rounded-2xl w-full text-left transition-all"><div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center"><Mail size={20} /></div><div><h3 className="font-bold text-white text-sm">{txt.backupEmail}</h3><p className="text-[10px] text-slate-500">{txt.backupDesc}</p></div></button>
      <button onClick={onAnnualStats} className="flex items-center gap-4 bg-slate-900/50 border border-white/5 hover:border-pink-500/50 p-5 rounded-2xl w-full text-left transition-all"><div className="w-10 h-10 bg-pink-500/10 text-pink-500 rounded-xl flex items-center justify-center"><BarChart3 size={20} /></div><div><h3 className="font-bold text-white text-sm">{txt.annualStats}</h3><p className="text-[10px] text-slate-500">{txt.annualDesc}</p></div></button>
    </div>
  );
};

// ==========================================
// 5. APP PRINCIPAL
// ==========================================

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  
  // Datos
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [calculatedEntries, setCalculatedEntries] = useState<CalculatedEntry[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  
  // UI Estado
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewType>('stats');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark');
  const [lang, setLang] = useState<'es' | 'en'>(() => (localStorage.getItem(LANG_KEY) as 'es' | 'en') || 'es');

  // Widgets Dashboard
  const [tripKm, setTripKm] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);

  // Perfil
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile | null>(() => {
    try {
      const saved = localStorage.getItem(VEHICLE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const t = translations[lang] || translations.es;
  const txt = uiText[lang] || uiText.es;

  // Auth
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Modales
  const [showImport, setShowImport] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAnnualStats, setShowAnnualStats] = useState(false);

  // Formulario
  const [newEntryForm, setNewEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    kmFinal: '',
    fuelAmount: '',
    pricePerLiter: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lógica CSV Master Paleo
  const handleShareCSV = async () => {
    const headers = ['Fecha', 'Km Inicial', 'Km Final', 'Distancia', 'Litros', 'Precio/L', 'Coste Total', 'Consumo L/100km', 'Km/L', 'Reserva'];
    const rows = calculatedEntries.map(e => [
        e.date, e.kmInicial, e.kmFinal, e.distancia, e.fuelAmount.toFixed(2).replace('.', ','), e.pricePerLiter.toFixed(3).replace('.', ','), 
        e.cost.toFixed(2).replace('.', ','), e.consumption.toFixed(2).replace('.', ','), e.kmPerLiter.toFixed(2).replace('.', ','), e.kmReserva || ''
    ].join(';'));
    const csvContent = [headers.join(';'), ...rows].join('\n');
    const file = new File([csvContent], "fuelmaster_backup.csv", { type: "text/csv" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ title: 'FuelMaster Backup', files: [file] }); } catch (err) { console.log('Cancelado'); }
    } else { downloadCSV(calculatedEntries, "fuelmaster_backup.csv"); alert("Compartir no soportado. Descargando."); }
  };

  useEffect(() => { document.body.className = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(LANG_KEY, lang); }, [lang]);

  useEffect(() => {
    const initApp = async () => {
      try {
        if (isSupabaseConfigured) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) { setSession(currentSession); await fetchUserData(currentSession.user.id); } 
          else { loadLocalData(); }
        } else { setIsLocalMode(true); loadLocalData(); }
      } catch (e) { setIsLocalMode(true); loadLocalData(); } 
      finally { setIsLoading(false); }
    };
    initApp();
  }, []);

  const loadLocalData = () => { try { const saved = localStorage.getItem(LOCAL_STORAGE_KEY); if (saved) setEntries(JSON.parse(saved)); } catch (e) { setEntries([]); } };
  const fetchUserData = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: entriesData } = await supabase.from('fuel_entries').select('*').eq('user_id', userId).order('km_final', { ascending: true });
      if (entriesData) setEntries(entriesData.map(d => ({ id: String(d.id), date: String(d.date), kmInicial: Number(d.km_inicial), kmFinal: Number(d.km_final), fuelAmount: Number(d.fuel_amount), pricePerLiter: Number(d.price_per_liter), cost: Number(d.cost), distancia: Number(d.distancia), consumption: 0, kmPerLiter: 0 })));
      const { data: profileData } = await supabase.from('vehicle_profiles').select('*').eq('user_id', userId).single();
      if (profileData) {
        const profile: VehicleProfile = { registrationDate: profileData.registration_date, lastItvDate: profileData.last_itv_date, category: profileData.category as VehicleCategory, lastServiceKm: profileData.last_service_km, lastServiceDate: profileData.last_service_date };
        setVehicleProfile(profile); localStorage.setItem(VEHICLE_KEY, JSON.stringify(profile));
      }
    } catch (e) { loadLocalData(); }
  };

  useEffect(() => {
    if (entries.length > 0) {
      const calculated = calculateEntries(entries); setCalculatedEntries(calculated); setStats(getSummaryStats(calculated)); localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } else { setCalculatedEntries([]); setStats(null); }
  }, [entries]);

  const annualStats = useMemo(() => {
    if (!calculatedEntries.length) return { years: [], avgKm: 0, maxYearKm: 1 };
    const yearsMap: Record<number, number> = {};
    calculatedEntries.forEach(entry => { const [d,m,y] = entry.date.split('/').map(Number); if(y) yearsMap[y] = (yearsMap[y]||0) + (entry.distancia||0); });
    const years = Object.keys(yearsMap).map(Number).sort((a, b) => b - a).map(year => ({ year, totalKm: yearsMap[year] }));
    const avgKm = years.reduce((acc, curr) => acc + curr.totalKm, 0) / (years.length || 1);
    const maxYearKm = Math.max(...years.map(y => y.totalKm), 1);
    return { years, avgKm, maxYearKm };
  }, [calculatedEntries]);

  const handleSaveVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const profile: VehicleProfile = { registrationDate: fd.get('regDate') as string, lastItvDate: fd.get('lastItv') as string || undefined, category: fd.get('category') as VehicleCategory, lastServiceKm: Number(fd.get('lastServiceKm')) || undefined, lastServiceDate: fd.get('lastServiceDate') as string || undefined };
    setVehicleProfile(profile); localStorage.setItem(VEHICLE_KEY, JSON.stringify(profile));
    if (session?.user?.id && isSupabaseConfigured) await supabase.from('vehicle_profiles').upsert({ user_id: session.user.id, registration_date: profile.registrationDate, last_itv_date: profile.lastItvDate, category: profile.category, last_service_km: profile.lastServiceKm, last_service_date: profile.lastServiceDate });
    setShowHelp(false);
  };

  const deleteEntry = async (id: string) => {
    if (!confirm(String(t.confirmDelete))) return;
    if (session?.user?.id && isSupabaseConfigured) await supabase.from('fuel_entries').delete().eq('id', id);
    setEntries(entries.filter(e => e.id !== id));
  };

  const handleClearAllData = () => { if (confirm("¿BORRAR TODO? Acción irreversible.")) { localStorage.clear(); setEntries([]); setVehicleProfile(null); window.location.reload(); } };

  const getNextService = () => {
    if (!vehicleProfile?.lastServiceKm || !vehicleProfile?.lastServiceDate || !stats) return null;
    const kmDiff = Math.max(0, stats.lastOdometer - vehicleProfile.lastServiceKm);
    const kmRem = Math.max(0, 15000 - kmDiff);
    const nextDate = new Date(vehicleProfile.lastServiceDate); nextDate.setFullYear(nextDate.getFullYear() + 1);
    const daysRem = getDaysRemaining(nextDate.toISOString());
    const pct = Math.max((kmDiff / 15000) * 100, ((new Date().getTime() - new Date(vehicleProfile.lastServiceDate).getTime()) / (nextDate.getTime() - new Date(vehicleProfile.lastServiceDate).getTime())) * 100);
    return { nextKm: vehicleProfile.lastServiceKm + 15000, nextDate, kmRemaining: kmRem, daysRemaining: daysRem, servicePercent: Math.min(100, pct), isTimeLimit: pct > (kmDiff/15000)*100, isUrgent: kmRem < 1000 || daysRem < 30 };
  };

  const maint = getNextService();
  const itvDate = vehicleProfile ? calculateNextITV(vehicleProfile.registrationDate, vehicleProfile.category, vehicleProfile.lastItvDate) : null;
  const isItvValid = itvDate && !isNaN(itvDate.getTime());
  const itvDays = isItvValid ? getDaysRemaining(itvDate!.toISOString()) : 0;

  const getItvColor = (d: number) => d <= 0 ? 'text-red-600' : d < 15 ? 'text-red-500' : d <= 30 ? 'text-orange-500' : 'text-emerald-500';
  const getItvBg = (d: number) => d <= 0 ? 'bg-red-500/10 border-red-500/20' : d < 15 ? 'bg-red-500/5 border-red-500/10' : d <= 30 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20';
  
  const tripFuel = stats ? (Number(tripKm)/100)*stats.avgConsumption : 0;
  const tripCost = stats ? (Number(tripKm)/100)*stats.avgCostPer100Km : 0;
  const bestCons = calculatedEntries.length ? Math.min(...calculatedEntries.filter(e=>e.consumption>0).map(e=>e.consumption)) : 0;
  const avgRefill = stats && calculatedEntries.length ? stats.totalFuel/calculatedEntries.length : 0;
  const estRange = stats && stats.avgConsumption > 0 ? (avgRefill/stats.avgConsumption)*100 : 0;
  const carPos = Math.min(Number(tripKm), 1000)/1000*100;

  const trends = { consumption: calculatedEntries.slice(-5).map(e => e.consumption), efficiency: calculatedEntries.slice(-5).map(e => e.kmPerLiter), pvp: calculatedEntries.slice(-5).map(e => e.pricePerLiter), cost: calculatedEntries.slice(-5).map(e => e.cost), cost100: calculatedEntries.slice(-5).map(e => (e.cost/(e.distancia||1))*100), liters: calculatedEntries.slice(-5).map(e => e.fuelAmount), odometer: calculatedEntries.slice(-5).map(e => e.kmFinal) };
  const ecoColor = (!stats || stats.avgConsumption < 4.8) ? 'emerald' : stats.avgConsumption <= 5.5 ? 'amber' : 'orange';
  const ecoBg = `bg-${ecoColor}-500`;
  const ecoText = `text-${ecoColor}-500`;
  const ecoBorder = `border-${ecoColor}-500`;

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Zap className="text-emerald-500 animate-spin" /></div>;

  if (!session && !isLocalMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="premium-card w-full max-w-md p-10 space-y-8 animate-fade-in shadow-2xl text-center"><div className={`w-16 h-16 ${ecoBg} rounded-2xl flex items-center justify-center text-slate-950 mx-auto mb-6`}><Lock size={32} /></div><h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">{String(t.appTitle)}</h1><form onSubmit={async (e) => { e.preventDefault(); setIsAuthLoading(true); try { await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); window.location.reload(); } catch (err: any) { setAuthError(err.message); } finally { setIsAuthLoading(false); } }} className="space-y-6"><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="EMAIL" className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-emerald-500" required /><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="PASSWORD" className="w-full bg-slate-900 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-emerald-500" required />{authError && <p className="text-red-500 text-xs font-bold uppercase">{authError}</p>}<button type="submit" className={`w-full ${ecoBg} text-slate-950 py-4 rounded-xl font-black uppercase text-xs tracking-widest`}>{isAuthLoading ? '...' : String(t.enter)}</button></form><button onClick={() => setIsLocalMode(true)} className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-emerald-500">Modo Local</button></div></div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'light' ? 'light' : ''}`}>
      <nav className="h-16 bg-slate-950/40 backdrop-blur-xl border-b border-white/5 flex items-center px-6 sticky top-0 z-[60] justify-between"><div className="flex items-center gap-3"><div className={`w-8 h-8 ${ecoBg} rounded-lg flex items-center justify-center text-slate-900`}><Zap size={18} fill="currentColor" /></div><h1 className="text-lg font-black italic tracking-tighter uppercase text-white">{String(t.appTitle)}</h1></div><div className="flex items-center gap-3"><button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-slate-400 hover:text-white"><Globe size={20} /></button><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-slate-400 hover:text-white">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button><button onClick={() => setShowHelp(true)} className="text-slate-400 hover:text-white"><Settings size={20}/></button><button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-red-500 hover:text-red-400"><LogOut size={20} /></button></div></nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {stats ? (
          <>
            {view === 'stats' && <StatsViewInternal stats={stats} trends={trends} t={t} />}
            {view === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                <div className="lg:col-span-2 space-y-8"><div className="premium-card p-6 sm:p-10"><FuelChart data={calculatedEntries} type="consumption" /></div><div className="premium-card p-6 sm:p-10"><FuelChart data={calculatedEntries} type="efficiency" /></div></div>
                <div className="space-y-6">
                   <div className="premium-card p-6 border-l-4 border-indigo-500 flex flex-col gap-4"><h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-white"><Fuel size={14} className="text-indigo-500" /> {String(t.theoreticalRange)}</h3><div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col items-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">{String(t.fullTankRange)}</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black font-mono-prec text-white">{estRange.toFixed(0)}</span><span className="text-[10px] font-bold text-indigo-400">KM</span></div><div className="w-full h-2 bg-slate-900/50 rounded-full mt-5 overflow-hidden border border-white/5 relative"><div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400" style={{ width: `${Math.min((avgRefill/43)*100, 100)}%` }}></div></div></div></div>
                   <div className={`premium-card p-6 border-l-4 ${ecoBorder} flex flex-col gap-4`}><h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-white"><MapPin size={14} className={ecoText} /> {String(t.tripCalculator)}</h3><div className="relative h-8 w-full bg-slate-900/50 rounded-lg border border-white/5 overflow-hidden flex items-center px-4"><div className="absolute left-0 h-[1px] w-full border-t border-dashed border-slate-700/50"></div><div className="relative z-10 transition-all duration-500 ease-out" style={{ transform: `translateX(calc(${carPos}% - 24px))` }}><Car size={18} className={`${ecoText} drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]`} /></div></div><div className="space-y-3"><div className="relative"><input type="number" placeholder={String(t.tripDistance)} value={tripKm} onChange={(e) => setTripKm(e.target.value)} className={`w-full bg-slate-900 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:border-${ecoColor}-500 font-mono-prec`} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">KM</span></div>{tripKm && (<><div className="grid grid-cols-2 gap-2"><div className="bg-slate-900/50 p-3 rounded-xl border border-white/5"><p className="text-[7px] font-black text-slate-500 uppercase mb-1">{String(t.estFuel)}</p><p className={`text-sm font-black ${ecoText} font-mono-prec`}>{tripFuel.toFixed(1)} <span className="text-[8px] font-sans">L</span></p></div><div className="bg-slate-900/50 p-3 rounded-xl border border-white/5"><p className="text-[7px] font-black text-slate-500 uppercase mb-1">{String(t.estCost)}</p><p className="text-sm font-black text-white font-mono-prec">{tripCost.toFixed(2)} <span className="text-[8px] font-sans">€</span></p></div></div><button onClick={() => setShowComparison(!showComparison)} className={`w-full py-3 bg-${ecoColor}-500/10 hover:bg-${ecoColor}-500/20 ${ecoText} text-[8px] font-black uppercase rounded-lg border ${ecoBorder}/20 transition-all flex items-center justify-center gap-2`}><TrendingUp size={12} /> {showComparison ? txt.hide : txt.compare}</button></>)}</div></div>
                   <div className="premium-card p-6 border-l-4 border-blue-500 flex flex-col gap-6"><h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-white"><Settings size={14} className="text-blue-500" /> {String(t.vehicleProfile)}</h3><div className="space-y-4">{isItvValid && (<div className={`p-4 rounded-xl border transition-all ${getItvBg(itvDays)}`}><p className="text-[8px] font-bold text-slate-500 uppercase">{String(t.itvRemaining)}</p><div className="flex items-center gap-3"><p className={`text-2xl font-black font-mono-prec ${getItvColor(itvDays)}`}>{itvDays}</p>{itvDays <= 30 && <AlertCircle size={16} className={getItvColor(itvDays)} />}</div><p className="text-[8px] font-black uppercase text-slate-500">Vencimiento: {itvDate?.toLocaleDateString()}</p></div>)}{maint ? (<div className={`p-4 rounded-xl border transition-all ${maint.isUrgent ? 'bg-orange-500/10 border-orange-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}><div className="flex justify-between items-start mb-3"><p className="text-[8px] font-bold text-slate-500 uppercase">{txt.nextService}</p><div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">{txt.deadline}</p><p className="text-[10px] font-black text-white">{maint.nextDate.toLocaleDateString()}</p></div></div><div className="w-full h-3 bg-slate-900/50 rounded-full mb-4 overflow-hidden border border-white/5 relative"><div className={`h-full transition-all duration-1000 ease-out ${maint.isUrgent ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${maint.servicePercent}%` }}></div></div><div className="grid grid-cols-2 gap-3 mb-3"><div className={`p-2 rounded-lg border ${!maint.isTimeLimit ? 'bg-slate-800/50 border-white/10' : 'bg-slate-900/30 border-transparent'}`}><p className="text-[7px] text-slate-500 uppercase font-bold mb-1">{txt.distance}</p><p className={`text-lg font-black font-mono-prec ${!maint.isTimeLimit ? (maint.isUrgent ? 'text-orange-500' : 'text-blue-400') : 'text-slate-300'}`}>{maint.kmRemaining.toLocaleString()}<span className="text-[8px] font-sans text-slate-500 ml-1">KM</span></p></div><div className={`p-2 rounded-lg border ${maint.isTimeLimit ? 'bg-slate-800/50 border-white/10' : 'bg-slate-900/30 border-transparent'}`}><p className="text-[7px] text-slate-500 uppercase font-bold mb-1">{txt.time}</p><p className={`text-lg font-black font-mono-prec ${maint.isTimeLimit ? (maint.isUrgent ? 'text-orange-500' : 'text-blue-400') : 'text-slate-300'}`}>{maint.daysRemaining}<span className="text-[8px] font-sans text-slate-500 ml-1">{txt.days}</span></p></div></div><p className="text-[8px] text-slate-500 uppercase font-black text-center">{maint.servicePercent.toFixed(0)}% {txt.lifeConsumed}</p></div>) : <div className="p-4 rounded-xl bg-slate-900 border border-white/5"><p className="text-[8px] font-black text-slate-500 uppercase text-center">{txt.configMaint}</p></div>}<button onClick={() => setShowHelp(true)} className="w-full mt-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase rounded-lg border border-blue-500/20"><Settings size={12} className="inline mr-2"/>{txt.manageProfile}</button></div></div>
                </div>
              </div>
            )}
            {view === 'history' && <HistoryViewInternal entries={calculatedEntries} onDelete={deleteEntry} t={t} />}
            {view === 'tools' && <ToolsViewInternal onImport={() => setShowImport(true)} onExportCSV={() => downloadCSV(calculatedEntries, 'FuelMaster_Backup.csv')} onExportPDF={() => exportToPDF(stats, calculatedEntries, vehicleProfile, maint)} onBackupEmail={handleShareCSV} onAnnualStats={() => setShowAnnualStats(true)} lang={lang} />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6"><div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center animate-pulse"><Zap size={40} className="text-slate-700" /></div><p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Sin datos registrados</p><div className="flex gap-4"><button onClick={() => setShowImport(true)} className="px-6 py-3 bg-slate-800 rounded-xl text-white font-bold text-xs uppercase flex items-center gap-2"><Upload size={16}/> Importar</button><button onClick={() => setShowNewEntry(true)} className={`px-6 py-3 ${ecoBg} text-slate-900 rounded-xl font-bold text-xs uppercase flex items-center gap-2`}><Plus size={16}/> Nuevo</button></div></div>
        )}
      </main>

      <BottomNavInternal activeView={view} onNavigate={(v) => setView(v)} lang={lang} />

      {stats && <button onClick={() => setShowNewEntry(true)} className={`fixed bottom-24 right-6 w-14 h-14 ${ecoBg} text-slate-900 rounded-full shadow-lg shadow-${ecoColor}-500/30 flex items-center justify-center z-40 hover:scale-110 transition-transform`}><Plus size={28} /></button>}

      {showNewEntry && (<div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"><div className="bg-slate-900 border border-white/10 w-full max-w-lg p-6 rounded-3xl relative shadow-2xl"><button onClick={() => setShowNewEntry(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={24}/></button><h3 className="text-lg font-black uppercase text-white mb-6 flex items-center gap-2"><Fuel size={20} className={ecoText} /> {txt.newReportTitle}</h3><form onSubmit={async (e) => { e.preventDefault(); const lit = Number(newEntryForm.fuelAmount); const pvp = Number(newEntryForm.pricePerLiter); const kf = Number(newEntryForm.kmFinal); const prev = calculatedEntries[calculatedEntries.length - 1]; const ki = prev ? prev.kmFinal : kf - 500; const newE: FuelEntry = { id: `en-${Date.now()}`, date: newEntryForm.date.split('-').reverse().join('/'), kmInicial: ki, kmFinal: kf, fuelAmount: lit, pricePerLiter: pvp, cost: lit * pvp, distancia: kf - ki, consumption: 0, kmPerLiter: 0 }; setEntries([...entries, newE]); setShowNewEntry(false); }} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.date}</label><input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm" required /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.currentKm}</label><input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm" required /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.liters}</label><input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm" required /></div><div className="space-y-1 col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.price}</label><input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm" required /></div></div><button type="submit" className={`w-full py-4 ${ecoBg} text-slate-900 rounded-xl font-bold uppercase text-xs tracking-widest mt-4`}>{txt.save}</button></form></div></div>)}
      {showImport && (<div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"><div className="bg-slate-900 border border-white/10 w-full max-w-md p-8 rounded-3xl relative text-center"><button onClick={() => setShowImport(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={24}/></button><div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed border-slate-700 hover:border-${ecoColor}-500 rounded-2xl p-10 cursor-pointer transition-colors group`}><Upload className="mx-auto mb-4 text-slate-500 group-hover:text-white" size={40} /><p className="text-xs font-bold uppercase text-slate-400">{txt.importDesc}</p></div><input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(!file) return; const reader = new FileReader(); reader.onload = async (evt) => { try { const parsed = parseFuelCSV(evt.target?.result as string); setEntries(parsed); setShowImport(false); } catch(err) { alert("Error CSV"); } }; reader.readAsText(file); }} accept=".csv" className="hidden" /></div></div>)}
      {showHelp && (<div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"><div className="bg-slate-900 border border-white/10 w-full max-w-lg p-6 rounded-3xl relative h-[80vh] overflow-y-auto"><button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={24}/></button><h3 className="text-xl font-black uppercase text-white mb-6">{txt.settingsTitle}</h3><form onSubmit={handleSaveVehicle} className="space-y-6"><div className="space-y-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.registration}</label><input name="regDate" type="date" defaultValue={vehicleProfile?.registrationDate} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-white text-sm" required /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.lastItv}</label><input name="lastItv" type="date" defaultValue={vehicleProfile?.lastItvDate} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-white text-sm" /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-blue-500 uppercase">{txt.serviceKm}</label><input name="lastServiceKm" type="number" defaultValue={vehicleProfile?.lastServiceKm} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-white text-sm" /></div><div><label className="text-[10px] font-bold text-blue-500 uppercase">{txt.serviceDate}</label><input name="lastServiceDate" type="date" defaultValue={vehicleProfile?.lastServiceDate} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-white text-sm" /></div></div><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.vehicleType}</label><select name="category" defaultValue={vehicleProfile?.category || 'turismo'} className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-white text-sm"><option value="turismo">Turismo</option><option value="furgoneta">Furgoneta</option><option value="motocicleta">Moto</option></select></div></div><button type="submit" className={`w-full py-4 ${ecoBg} text-slate-900 rounded-xl font-bold uppercase text-xs`}>{txt.saveChanges}</button></form><div className="mt-8 pt-8 border-t border-white/5 text-center"><button onClick={handleClearAllData} className="text-red-500 text-[10px] font-bold uppercase hover:text-red-400">{txt.deleteAll}</button></div></div></div>)}
      {showAnnualStats && (<div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"><div className="bg-slate-900 border border-white/10 w-full max-w-lg p-6 rounded-3xl relative h-[60vh] overflow-y-auto"><button onClick={() => setShowAnnualStats(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={24}/></button><h3 className="text-xl font-black uppercase text-white mb-6 text-center">{txt.annualStats}</h3><div className="text-center mb-8"><p className="text-[10px] font-bold text-slate-500 uppercase">Media por Año</p><p className="text-3xl font-black text-white">{annualStats.avgKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-slate-500">KM</span></p></div><div className="space-y-4">{annualStats.years.map(({ year, totalKm }) => (<div key={year} className="space-y-1"><div className="flex justify-between text-xs font-bold text-slate-400"><span>{year}</span><span>{totalKm.toLocaleString()} km</span></div><div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(totalKm / annualStats.maxYearKm) * 100}%` }} /></div></div>))}</div></div></div>)}
    </div>
  );
};

export default App;
