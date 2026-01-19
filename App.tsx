import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Zap, Activity, Wrench, X, Plus, 
  Euro, Navigation, Trash2, Fuel, TrendingUp, 
  Database, Lock, Download, LogOut, ShieldCheck, 
  AlertCircle, Calendar, Sun, Moon, FileText, Globe, Settings, MapPin, Car, Info, BarChart3, Briefcase, Share2, LayoutDashboard, History, HelpCircle
} from 'lucide-react';

// --- IMPORTS ---
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { FuelEntry, CalculatedEntry, SummaryStats, VehicleProfile, VehicleCategory } from './types';
import { parseFuelCSV } from './utils/csvParser';
import { calculateEntries, getSummaryStats, getDaysRemaining } from './utils/calculations';
import { calculateNextITV } from './utils/itvLogic';
import { exportToPDF } from './utils/pdfExport';
import { downloadCSV, shareCSV } from './utils/csvExport'; 
import { translations } from './utils/translations';
import FuelChart from './components/FuelChart'; 

const LOCAL_STORAGE_KEY = 'fuelmaster_entries';
const VEHICLE_KEY = 'fuelmaster_vehicle';
const THEME_KEY = 'fuelmaster_theme';
const LANG_KEY = 'fuelmaster_lang';

// Reducimos las vistas principales a 3
type ViewType = 'stats' | 'dashboard' | 'garage';

// --- DICCIONARIO UI LOCAL ---
const uiText = {
  es: {
    garageTitle: "Mi Garaje",
    garageDesc: "Gestión y Herramientas",
    historyBtn: "Historial Completo",
    historyDesc: "Ver tabla de registros",
    importData: "Importar CSV",
    exportCsv: "Exportar CSV",
    reportPdf: "Reporte PDF",
    backupEmail: "Compartir / Backup",
    annualStats: "Analítica Anual",
    annualDesc: "Desglose por años",
    nextService: "Próxima Revisión",
    deadline: "Fecha Límite",
    distance: "Distancia",
    time: "Tiempo",
    days: "DÍAS",
    lifeConsumed: "vida útil consumida",
    manageProfile: "Ajustes Coche",
    configMaint: "Configura tu mantenimiento",
    compare: "Comparar",
    hide: "Ocultar",
    newReportTitle: "Nuevo Repostaje",
    date: "Fecha",
    currentKm: "Km Actuales",
    liters: "Litros",
    price: "Precio €/L",
    save: "Guardar",
    settingsTitle: "Perfil del Vehículo",
    brand: "Marca",
    model: "Modelo",
    registration: "Matriculación",
    lastItv: "Última ITV",
    serviceKm: "Km Revisión",
    serviceDate: "Fecha Revisión",
    vehicleType: "Tipo Vehículo",
    saveChanges: "Guardar Cambios",
    deleteAll: "Borrar todos los datos",
    navStats: "Resumen",
    navDash: "Analítica",
    navGarage: "Garaje",
    avgYear: "Media Anual",
    helpTitle: "Guía de Uso",
    close: "Cerrar",
    brandPlaceholder: "Ej: Toyota",
    modelPlaceholder: "Ej: Corolla"
  },
  en: {
    garageTitle: "My Garage",
    garageDesc: "Management & Tools",
    historyBtn: "Full History",
    historyDesc: "View logs table",
    importData: "Import CSV",
    exportCsv: "Export CSV",
    reportPdf: "PDF Report",
    backupEmail: "Share / Backup",
    annualStats: "Annual Analytics",
    annualDesc: "Yearly breakdown",
    nextService: "Next Service",
    deadline: "Deadline",
    distance: "Distance",
    time: "Time",
    days: "DAYS",
    lifeConsumed: "lifespan consumed",
    manageProfile: "Car Settings",
    configMaint: "Configure maintenance",
    compare: "Compare",
    hide: "Hide",
    newReportTitle: "New Entry",
    date: "Date",
    currentKm: "Current Odometer",
    liters: "Liters",
    price: "Price €/L",
    save: "Save",
    settingsTitle: "Vehicle Profile",
    brand: "Brand",
    model: "Model",
    registration: "Registration Date",
    lastItv: "Last MOT/ITV",
    serviceKm: "Service Km",
    serviceDate: "Service Date",
    vehicleType: "Vehicle Type",
    saveChanges: "Save Changes",
    deleteAll: "Delete All Data",
    navStats: "Summary",
    navDash: "Analytics",
    navGarage: "Garage",
    avgYear: "Annual Avg",
    helpTitle: "User Guide",
    close: "Close",
    brandPlaceholder: "Ex: Toyota",
    modelPlaceholder: "Ex: Corolla"
  }
};

// ==========================================
// 0. COMPONENTE STATCARD 
// ==========================================
const StatCard = ({ label, value, unit, icon, color, trendData }: any) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color.replace('bg-', 'text-')}`}>
                {React.cloneElement(icon, { size: 48 })}
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${color} text-white shadow-md`}>
                        {React.cloneElement(icon, { size: 16 })}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900 dark:text-white font-mono-prec tracking-tight">{value}</span>
                    <span className="text-[10px] font-bold text-slate-400">{unit}</span>
                </div>
                {trendData && (
                    <div className="flex items-end gap-[2px] h-6 mt-3 opacity-50">
                        {trendData.map((d: number, i: number) => (
                            <div key={i} className={`w-1 rounded-t-sm ${color}`} style={{ height: `${Math.min((d / (Math.max(...trendData)||1)) * 100, 100)}%` }}></div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// 1. BARRA DE NAVEGACIÓN (3 ITEMS)
// ==========================================
const BottomNavInternal = ({ activeView, onNavigate, lang }: { activeView: ViewType, onNavigate: (v: ViewType) => void, lang: 'es'|'en' }) => {
  const txt = uiText[lang];
  const navItems = [
    { id: 'stats', label: txt.navStats, icon: <Activity size={20} /> },
    { id: 'dashboard', label: txt.navDash, icon: <BarChart3 size={20} /> },
    { id: 'garage', label: txt.navGarage, icon: <Car size={20} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 pb-safe safe-area-pb">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewType)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${
                isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {isActive && <span className="absolute top-0 w-12 h-0.5 bg-emerald-500 rounded-b-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
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
// 2. VISTA RESUMEN (HOME) - RECUPERADA TARJETA ANUAL
// ==========================================
const StatsViewInternal = ({ stats, trends, t, txt, annualStats }: any) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
    <StatCard label={String(t.consumption)} value={stats.avgConsumption.toFixed(2)} unit="L/100" icon={<Activity size={20}/>} color="bg-blue-500" trendData={trends.consumption} />
    <StatCard label={String(t.efficiency)} value={stats.avgKmPerLiter.toFixed(2)} unit="km/L" icon={<Zap size={20}/>} color="bg-emerald-500" trendData={trends.efficiency} />
    <StatCard label={String(t.avgPvp)} value={stats.avgPricePerLiter.toFixed(3)} unit="€/L" icon={<Euro size={20}/>} color="bg-amber-500" trendData={trends.pvp} />
    <StatCard label={String(t.totalCost)} value={stats.totalCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })} unit="€" icon={<Database size={20}/>} color="bg-violet-500" trendData={trends.cost} />
    
    {/* Tarjeta Recuperada: Media Anual */}
    <StatCard label={txt.avgYear} value={annualStats.avgKm.toLocaleString('es-ES', { maximumFractionDigits: 0 })} unit="km/año" icon={<Calendar size={20}/>} color="bg-pink-500" trendData={null} />
    
    <StatCard label={String(t.cost100)} value={stats.avgCostPer100Km.toFixed(2)} unit="€" icon={<TrendingUp size={20}/>} color="bg-rose-500" trendData={trends.cost100} />
    <StatCard label={String(t.liters)} value={stats.totalFuel.toFixed(0)} unit="L" icon={<Fuel size={20}/>} color="bg-indigo-500" trendData={trends.liters} />
    <StatCard label={String(t.odometer)} value={stats.lastOdometer.toLocaleString()} unit="km" icon={<Navigation size={20}/>} color="bg-slate-500" trendData={trends.odometer} />
  </div>
);

// ==========================================
// 3. VISTA GARAJE (CORREGIDA: INCLUYE AUTONOMÍA Y ANIMACIÓN COCHE)
// ==========================================
const GarageViewInternal = ({ 
    vehicleProfile, maint, itvDate, itvDays, isItvValid, getItvColor, getItvBg,
    tripKm, setTripKm, tripFuel, tripCost, showComparison, setShowComparison,
    estRange, avgRefill, carPos,
    onImport, onExportCSV, onExportPDF, onBackupEmail, onShowHistory, onOpenSettings,
    lang, ecoColor, ecoText, ecoBorder, txt, t 
}: any) => {
  
  const btnClass = "flex flex-col items-center justify-center bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 hover:border-emerald-500/50 p-4 rounded-2xl w-full text-center transition-all shadow-sm dark:shadow-none gap-2 active:scale-95";
  
  const brand = (vehicleProfile as any)?.brand || "Mi Coche";
  const model = (vehicleProfile as any)?.model || "";

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      
      {/* 1. FICHA DEL COCHE + MANTENIMIENTO */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-white/5 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none"><Car size={120} /></div>
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{brand}</h2>
                    <p className="text-sm font-bold text-slate-500 uppercase">{model}</p>
                </div>
                <button onClick={onOpenSettings} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <Settings size={20} className="text-slate-600 dark:text-slate-300"/>
                </button>
            </div>

            <div className="space-y-3">
                {/* ITV */}
                {isItvValid && (
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${getItvBg(itvDays)}`}>
                        <div>
                            <p className="text-[9px] font-black uppercase opacity-70">ITV / MOT</p>
                            <p className={`text-xs font-bold ${getItvColor(itvDays)}`}>Vence: {itvDate?.toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                             <p className={`text-lg font-black font-mono-prec ${getItvColor(itvDays)}`}>{itvDays} <span className="text-[9px] font-sans text-slate-500">días</span></p>
                        </div>
                    </div>
                )}
                
                {/* Revisión */}
                {maint ? (
                     <div className={`p-3 rounded-xl border flex flex-col gap-2 ${maint.isUrgent ? 'bg-orange-500/10 border-orange-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                         <div className="flex justify-between items-center">
                             <p className="text-[9px] font-black uppercase opacity-70">{txt.nextService}</p>
                             <p className="text-[9px] font-bold opacity-80">{maint.nextDate.toLocaleDateString()}</p>
                         </div>
                         <div className="w-full h-2 bg-slate-200 dark:bg-slate-900/30 rounded-full overflow-hidden">
                             <div className={`h-full ${maint.isUrgent ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${maint.servicePercent}%` }}></div>
                         </div>
                         <div className="flex justify-between text-[9px] font-bold opacity-80">
                             <span>{maint.kmRemaining.toLocaleString()} km rest.</span>
                             <span>{maint.daysRemaining} días rest.</span>
                         </div>
                     </div>
                ) : (
                    <button onClick={onOpenSettings} className="w-full py-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 uppercase hover:border-blue-500 hover:text-blue-500 transition-colors">
                        {txt.configMaint}
                    </button>
                )}
            </div>
         </div>
      </div>

      {/* 2. AUTONOMÍA INTELIGENTE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-white/5 p-6 border-l-4 border-indigo-500 flex flex-col gap-4">
        <h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-900 dark:text-white">
            <Fuel size={14} className="text-indigo-500" /> {String(t.theoreticalRange)}
        </h3>
        <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col items-center">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">{String(t.fullTankRange)}</p>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-mono-prec text-slate-900 dark:text-white">{estRange.toFixed(0)}</span>
                <span className="text-[10px] font-bold text-indigo-400">KM</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-900/50 rounded-full mt-5 overflow-hidden border border-slate-200 dark:border-white/5 relative">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400" style={{ width: `${Math.min((avgRefill/43)*100, 100)}%` }}></div>
            </div>
        </div>
      </div>

      {/* 3. CALCULADORA DE TRAYECTO */}
      <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-white/5 p-6 border-l-4 ${ecoBorder}`}>
          <h3 className={`text-[10px] font-black uppercase flex items-center gap-2 text-slate-900 dark:text-white mb-4`}><MapPin size={14} className={ecoText} /> Calculadora de Viaje</h3>
          
          <div className="relative h-8 w-full bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-white/5 overflow-hidden flex items-center px-4 mb-4">
            <div className="absolute left-0 h-[1px] w-full border-t border-dashed border-slate-400/50 dark:border-slate-700/50"></div>
            <div className="relative z-10 transition-all duration-500 ease-out" style={{ transform: `translateX(calc(${carPos}% - 24px))` }}>
                <Car size={18} className={`${ecoText} drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
                <input type="number" placeholder={String(t.tripDistance)} value={tripKm} onChange={(e) => setTripKm(e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white border rounded-xl py-3 px-4 text-xs font-bold outline-none focus:border-${ecoColor}-500 font-mono-prec`} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">KM</span>
            </div>
            {tripKm && (
                <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                        <p className="text-[7px] font-black text-slate-500 uppercase mb-1">{String(t.estFuel)}</p>
                        <p className={`text-sm font-black ${ecoText} font-mono-prec`}>{tripFuel.toFixed(1)} <span className="text-[8px] font-sans">L</span></p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                        <p className="text-[7px] font-black text-slate-500 uppercase mb-1">{String(t.estCost)}</p>
                        <p className="text-sm font-black text-slate-900 dark:text-white font-mono-prec">{tripCost.toFixed(2)} <span className="text-[8px] font-sans">€</span></p>
                    </div>
                </div>
            )}
          </div>
      </div>

      {/* 4. GRID DE HERRAMIENTAS */}
      <div className="grid grid-cols-2 gap-3">
          <button onClick={onShowHistory} className={`${btnClass} col-span-2 flex-row gap-3 border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10`}>
              <History size={20} className="text-blue-600 dark:text-blue-400"/>
              <div className="text-left">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{txt.historyBtn}</h3>
                  <p className="text-[9px] text-slate-500">{txt.historyDesc}</p>
              </div>
          </button>
          
          <button onClick={onImport} className={btnClass}>
              <Upload size={20} className="text-emerald-500"/>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{txt.importData}</span>
          </button>
          
          <button onClick={onExportCSV} className={btnClass}>
              <FileText size={20} className="text-blue-500"/>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{txt.exportCsv}</span>
          </button>
          
          <button onClick={onExportPDF} className={btnClass}>
              <Download size={20} className="text-violet-500"/>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{txt.reportPdf}</span>
          </button>
          
          <button onClick={onBackupEmail} className={btnClass}>
              <Share2 size={20} className="text-amber-500"/>
              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{txt.backupEmail}</span>
          </button>
      </div>
    </div>
  );
};

// ==========================================
// 4. NUEVA GUÍA DE AYUDA (MODAL INTERNO)
// ==========================================
const GuideModal = ({ onClose, lang }: { onClose: () => void, lang: 'es'|'en' }) => {
  const isEs = lang === 'es';
  const modalBg = "bg-white dark:bg-slate-900";
  const modalText = "text-slate-900 dark:text-white";

  const content = {
    title: isEs ? "Guía FuelMaster Pro" : "FuelMaster Pro Guide",
    maintTitle: isEs ? "Mantenimiento & ITV" : "Maintenance & MOT",
    maintDesc: isEs 
       ? "Revisiones: El sistema usa la regla de 'lo que ocurra antes': 15.000 km o 1 año desde el último servicio."
       : "Service: System uses 'whichever comes first': 15,000 km or 1 year since last service.",
    itvDesc: isEs 
       ? "Control ITV: Basado en la normativa española (4-2-1 años). Introduce la fecha de matriculación y categoría en Ajustes; la App calculará la fecha legal automáticamente."
       : "MOT/ITV: Based on local regulations (4-2-1 years). Enter registration date & category in Settings; App calculates deadline automatically.",
    colors: isEs 
       ? "🎨 Semáforo: 🟢 Todo bien | 🟠 Aviso (Menos de 1 mes o 1000km) | 🔴 Vencido."
       : "🎨 Status: 🟢 All good | 🟠 Warning (< 1 month or 1000km) | 🔴 Expired.",
    dataTitle: isEs ? "Datos y Backups" : "Data & Backups",
    emailText: isEs
       ? "📧 Backup Email: Abre el menú nativo de 'Compartir' de tu móvil para enviar el archivo CSV por Correo, WhatsApp, Telegram o guardarlo en Drive."
       : "📧 Email Backup: Opens native 'Share' menu to send CSV via Email, WhatsApp, Telegram or save to Drive.",
    csvText: isEs ? "📂 Exportar CSV: Descarga directa del archivo de datos para Excel." : "📂 Export CSV: Direct download of data file for Excel.",
    pdfText: isEs ? "📄 Reporte PDF: Genera un informe visual oficial con gráficas y totales." : "📄 PDF Report: Generates an official visual report with charts and totals.",
    accountTitle: isEs ? "Sincronización" : "Synchronization",
    accountDesc: isEs
       ? "Modo Invitado = Datos solo en este móvil. Crea una cuenta para tener copia en la nube y acceder desde varios dispositivos."
       : "Guest Mode = Data on this phone only. Create an account to backup to cloud and access from multiple devices."
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`${modalBg} rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200`}>
         <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center z-10">
            <h2 className={`text-xl font-black italic uppercase ${modalText} flex items-center gap-2`}><span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg"><HelpCircle size={20} /></span>{content.title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"><X size={20} /></button>
         </div>
         <div className="p-6 space-y-8">
            <div className="space-y-3"><h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">{content.maintTitle}</h3><div className="flex gap-4"><div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl h-fit text-orange-600 dark:text-orange-400"><Wrench size={24}/></div><div className="space-y-3"><p className={`text-xs ${modalText}`}>{content.maintDesc}</p><p className={`text-xs font-medium text-blue-600 dark:text-blue-400`}>{content.itvDesc}</p><div className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300">{content.colors}</div></div></div></div>
            <div className="space-y-3"><h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">{content.dataTitle}</h3><div className="grid gap-3"><div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5"><Share2 size={18} className="text-amber-500 mt-0.5 shrink-0"/><p className={`text-xs ${modalText}`}>{content.emailText}</p></div><div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5"><FileText size={18} className="text-blue-500 mt-0.5 shrink-0"/><p className={`text-xs ${modalText}`}>{content.csvText}</p></div><div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5"><Download size={18} className="text-violet-500 mt-0.5 shrink-0"/><p className={`text-xs ${modalText}`}>{content.pdfText}</p></div></div></div>
             <div className="space-y-3"><h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">{content.accountTitle}</h3><div className="flex gap-4"><div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl h-fit text-emerald-600 dark:text-emerald-400"><Zap size={24}/></div><p className={`text-xs ${modalText}`}>{content.accountDesc}</p></div></div>
         </div>
         <div className="sticky bottom-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 border-t border-slate-100 dark:border-white/5 flex justify-end"><button onClick={onClose} className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold uppercase text-xs rounded-xl hover:opacity-90">{uiText[lang].close}</button></div>
      </div>
    </div>
  );
};


// ==========================================
// 6. APP PRINCIPAL
// ==========================================

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [calculatedEntries, setCalculatedEntries] = useState<CalculatedEntry[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewType>('stats');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark');
  const [lang, setLang] = useState<'es' | 'en'>(() => (localStorage.getItem(LANG_KEY) as 'es' | 'en') || 'es');
  const [tripKm, setTripKm] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile | null>(() => {
    try { const saved = localStorage.getItem(VEHICLE_KEY); return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const t = translations[lang] || translations.es;
  const txt = uiText[lang] || uiText.es;

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [showGuide, setShowGuide] = useState(false);       
  const [showHistory, setShowHistory] = useState(false); // Modal Historial
  const [newEntryForm, setNewEntryForm] = useState({ date: new Date().toISOString().split('T')[0], kmFinal: '', fuelAmount: '', pricePerLiter: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV
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
          if (currentSession) { setSession(currentSession); await fetchUserData(currentSession.user.id); } else { loadLocalData(); }
        } else { setIsLocalMode(true); loadLocalData(); }
      } catch (e) { setIsLocalMode(true); loadLocalData(); } finally { setIsLoading(false); }
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
        // En supabase guardamos marca/modelo si extendiéramos, por ahora lo cargamos y guardamos en profile local
        const profile: VehicleProfile = { 
            registrationDate: profileData.registration_date, 
            lastItvDate: profileData.last_itv_date, 
            category: profileData.category as VehicleCategory, 
            lastServiceKm: profileData.last_service_km, 
            lastServiceDate: profileData.last_service_date,
            // Truco: Supabase no tiene marca/modelo aún, usaremos localStorage para persistir esto localmente
            brand: (JSON.parse(localStorage.getItem(VEHICLE_KEY) || '{}')).brand || 'Mi Coche',
            model: (JSON.parse(localStorage.getItem(VEHICLE_KEY) || '{}')).model || ''
        } as any;
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
    const profile: VehicleProfile = { 
        registrationDate: fd.get('regDate') as string, 
        lastItvDate: fd.get('lastItv') as string || undefined, 
        category: fd.get('category') as VehicleCategory, 
        lastServiceKm: Number(fd.get('lastServiceKm')) || undefined, 
        lastServiceDate: fd.get('lastServiceDate') as string || undefined,
        // Nuevos campos
        brand: fd.get('brand') as string,
        model: fd.get('model') as string
    } as any;
    setVehicleProfile(profile); localStorage.setItem(VEHICLE_KEY, JSON.stringify(profile));
    
    // Solo subimos los campos standard a Supabase para no romper
    if (session?.user?.id && isSupabaseConfigured) await supabase.from('vehicle_profiles').upsert({ user_id: session.user.id, registration_date: profile.registrationDate, last_itv_date: profile.lastItvDate, category: profile.category, last_service_km: profile.lastServiceKm, last_service_date: profile.lastServiceDate });
    setShowSettings(false);
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
  const estRange = stats && stats.avgConsumption > 0 ? ( (stats.totalFuel/calculatedEntries.length) / stats.avgConsumption)*100 : 0;
  const carPos = Math.min(Number(tripKm), 1000)/1000*100;
  const avgRefill = stats && calculatedEntries.length ? stats.totalFuel/calculatedEntries.length : 0;

  const trends = { consumption: calculatedEntries.slice(-5).map(e => e.consumption), efficiency: calculatedEntries.slice(-5).map(e => e.kmPerLiter), pvp: calculatedEntries.slice(-5).map(e => e.pricePerLiter), cost: calculatedEntries.slice(-5).map(e => e.cost), cost100: calculatedEntries.slice(-5).map(e => (e.cost/(e.distancia||1))*100), liters: calculatedEntries.slice(-5).map(e => e.fuelAmount), odometer: calculatedEntries.slice(-5).map(e => e.kmFinal) };
  const ecoColor = (!stats || stats.avgConsumption < 4.8) ? 'emerald' : stats.avgConsumption <= 5.5 ? 'amber' : 'orange';
  const ecoBg = `bg-${ecoColor}-500`;
  const ecoText = `text-${ecoColor}-600 dark:text-${ecoColor}-500`;
  const ecoBorder = `border-${ecoColor}-500`;

  const modalBg = "bg-white dark:bg-slate-900";
  const modalText = "text-slate-900 dark:text-white";
  const modalInput = "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white";

  if (isLoading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white"><Zap className="text-emerald-500 animate-spin" /></div>;

  if (!session && !isLocalMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 w-full max-w-md p-10 space-y-8 animate-fade-in shadow-xl rounded-3xl text-center"><div className={`w-16 h-16 ${ecoBg} rounded-2xl flex items-center justify-center text-slate-950 mx-auto mb-6`}><Lock size={32} /></div><h1 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white">{String(t.appTitle)}</h1><form onSubmit={async (e) => { e.preventDefault(); setIsAuthLoading(true); try { await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); window.location.reload(); } catch (err: any) { setAuthError(err.message); } finally { setIsAuthLoading(false); } }} className="space-y-6"><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="EMAIL" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl py-4 px-6 text-slate-900 dark:text-white outline-none focus:border-emerald-500" required /><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="PASSWORD" className="w-full bg-slate-5 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl py-4 px-6 text-slate-900 dark:text-white outline-none focus:border-emerald-500" required />{authError && <p className="text-red-500 text-xs font-bold uppercase">{authError}</p>}<button type="submit" className={`w-full ${ecoBg} text-slate-950 py-4 rounded-xl font-black uppercase text-xs tracking-widest`}>{isAuthLoading ? '...' : String(t.enter)}</button></form><button onClick={() => setIsLocalMode(true)} className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-emerald-500">Modo Local</button></div></div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'}`}>
      <nav className="h-16 bg-white/80 dark:bg-slate-950/40 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center px-6 sticky top-0 z-[60] justify-between">
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${ecoBg} rounded-lg flex items-center justify-center text-slate-900`}><Zap size={18} fill="currentColor" /></div>
            <h1 className="text-lg font-black italic tracking-tighter uppercase text-slate-900 dark:text-white">{String(t.appTitle)}</h1>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><Globe size={20} /></button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            {/* GUÍA */}
            <button onClick={() => setShowGuide(true)} className="text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400"><HelpCircle size={20}/></button>
            {/* LOGOUT */}
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-red-500 hover:text-red-600 dark:hover:text-red-400"><LogOut size={20} /></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {stats ? (
          <>
            {view === 'stats' && <StatsViewInternal stats={stats} trends={trends} t={t} txt={txt} annualStats={annualStats} />}
            
            {view === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                  {/* Gráficos Visuales */}
                  <div className="space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 dark:border-white/5"><FuelChart data={calculatedEntries} type="consumption" /></div>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 dark:border-white/5"><FuelChart data={calculatedEntries} type="efficiency" /></div>
                  </div>
                  
                  {/* Tarjeta Analítica Anual (Insertada aquí) */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-white/5 h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-pink-500/10 p-3 rounded-xl text-pink-500"><BarChart3 size={24}/></div>
                            <div>
                                <h3 className="font-black uppercase text-slate-900 dark:text-white text-lg">{txt.annualStats}</h3>
                                <p className="text-xs text-slate-500">{txt.annualDesc}</p>
                            </div>
                        </div>
                        <div className="text-center mb-8 border-b border-slate-100 dark:border-white/5 pb-8">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{txt.avgYear}</p>
                            <p className={`text-4xl font-black ${modalText}`}>{annualStats.avgKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-slate-500">KM</span></p>
                        </div>
                        <div className="space-y-4">
                            {annualStats.years.map(({ year, totalKm }) => (
                                <div key={year} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-slate-400"><span>{year}</span><span>{totalKm.toLocaleString()} km</span></div>
                                    <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-pink-500" style={{ width: `${(totalKm / annualStats.maxYearKm) * 100}%` }} /></div>
                                </div>
                            ))}
                        </div>
                  </div>
              </div>
            )}
            
            {view === 'garage' && (
                <GarageViewInternal 
                    vehicleProfile={vehicleProfile} maint={maint} itvDate={itvDate} itvDays={itvDays} isItvValid={isItvValid}
                    getItvColor={getItvColor} getItvBg={getItvBg}
                    tripKm={tripKm} setTripKm={setTripKm} tripFuel={tripFuel} tripCost={tripCost}
                    showComparison={showComparison} setShowComparison={setShowComparison}
                    estRange={estRange} avgRefill={avgRefill} carPos={carPos}
                    onImport={() => setShowImport(true)} onExportCSV={() => downloadCSV(calculatedEntries, 'FuelMaster_Backup.csv')}
                    onExportPDF={() => exportToPDF(stats, calculatedEntries, vehicleProfile, maint)}
                    onBackupEmail={handleShareCSV} onShowHistory={() => setShowHistory(true)}
                    onOpenSettings={() => setShowSettings(true)}
                    lang={lang} ecoColor={ecoColor} ecoText={ecoText} ecoBorder={ecoBorder} txt={txt} t={t}
                />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6"><div className="w-20 h-20 bg-slate-200 dark:bg-slate-900 rounded-full flex items-center justify-center animate-pulse"><Zap size={40} className="text-slate-400 dark:text-slate-700" /></div><p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Sin datos registrados</p><div className="flex gap-4"><button onClick={() => setShowImport(true)} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase flex items-center gap-2"><Upload size={16}/> Importar</button><button onClick={() => setShowNewEntry(true)} className={`px-6 py-3 ${ecoBg} text-slate-900 rounded-xl font-bold text-xs uppercase flex items-center gap-2`}><Plus size={16}/> Nuevo</button></div></div>
        )}
      </main>

      {/* --- BARRA DE NAVEGACIÓN Y FAB --- */}
      <BottomNavInternal activeView={view} onNavigate={(v) => setView(v)} lang={lang} />
      {stats && <button onClick={() => setShowNewEntry(true)} className={`fixed bottom-24 right-6 w-14 h-14 ${ecoBg} text-slate-900 rounded-full shadow-lg shadow-${ecoColor}-500/30 flex items-center justify-center z-40 hover:scale-110 transition-transform active:scale-95`}><Plus size={28} /></button>}

      {/* --- MODALES --- */}
      
      {/* 1. NUEVO REPOSTAJE */}
      {showNewEntry && (<div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"><div className={`${modalBg} border border-slate-200 dark:border-white/10 w-full max-w-lg p-6 rounded-3xl relative shadow-2xl animate-in fade-in zoom-in-95 duration-200`}><button onClick={() => setShowNewEntry(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={24}/></button><h3 className={`text-lg font-black uppercase ${modalText} mb-6 flex items-center gap-2`}><Fuel size={20} className={ecoText} /> {txt.newReportTitle}</h3><form onSubmit={async (e) => { e.preventDefault(); const lit = Number(newEntryForm.fuelAmount); const pvp = Number(newEntryForm.pricePerLiter); const kf = Number(newEntryForm.kmFinal); const prev = calculatedEntries[calculatedEntries.length - 1]; const ki = prev ? prev.kmFinal : kf - 500; const newE: FuelEntry = { id: `en-${Date.now()}`, date: newEntryForm.date.split('-').reverse().join('/'), kmInicial: ki, kmFinal: kf, fuelAmount: lit, pricePerLiter: pvp, cost: lit * pvp, distancia: kf - ki, consumption: 0, kmPerLiter: 0 }; setEntries([...entries, newE]); setShowNewEntry(false); }} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.date}</label><input type="date" value={newEntryForm.date} onChange={e => setNewEntryForm({...newEntryForm, date: e.target.value})} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} required /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.currentKm}</label><input type="number" value={newEntryForm.kmFinal} onChange={e => setNewEntryForm({...newEntryForm, kmFinal: e.target.value})} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} required /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.liters}</label><input type="number" step="0.01" value={newEntryForm.fuelAmount} onChange={e => setNewEntryForm({...newEntryForm, fuelAmount: e.target.value})} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} required /></div><div className="space-y-1 col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.price}</label><input type="number" step="0.001" value={newEntryForm.pricePerLiter} onChange={e => setNewEntryForm({...newEntryForm, pricePerLiter: e.target.value})} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} required /></div></div><button type="submit" className={`w-full py-4 ${ecoBg} text-slate-900 rounded-xl font-bold uppercase text-xs tracking-widest mt-4`}>{txt.save}</button></form></div></div>)}
      
      {/* 2. IMPORTAR CSV */}
      {showImport && (<div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"><div className={`${modalBg} border border-slate-200 dark:border-white/10 w-full max-w-md p-8 rounded-3xl relative text-center animate-in fade-in zoom-in-95 duration-200`}><button onClick={() => setShowImport(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={24}/></button><div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-${ecoColor}-500 rounded-2xl p-10 cursor-pointer transition-colors group`}><Upload className="mx-auto mb-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" size={40} /><p className="text-xs font-bold uppercase text-slate-400">{txt.importDesc}</p></div><input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if(!file) return; const reader = new FileReader(); reader.onload = async (evt) => { try { const parsed = parseFuelCSV(evt.target?.result as string); setEntries(parsed); setShowImport(false); } catch(err) { alert("Error CSV"); } }; reader.readAsText(file); }} accept=".csv" className="hidden" /></div></div>)}
      
      {/* 3. SETTINGS (PERFIL DE VEHÍCULO) */}
      {showSettings && (<div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"><div className={`${modalBg} border border-slate-200 dark:border-white/10 w-full max-w-lg p-6 rounded-3xl relative h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200`}><button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={24}/></button><h3 className={`text-xl font-black uppercase ${modalText} mb-6`}>{txt.settingsTitle}</h3><form onSubmit={handleSaveVehicle} className="space-y-6"><div className="space-y-4">
        {/* Marca y Modelo */}
        <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.brand}</label><input name="brand" type="text" placeholder={txt.brandPlaceholder} defaultValue={(vehicleProfile as any)?.brand} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.model}</label><input name="model" type="text" placeholder={txt.modelPlaceholder} defaultValue={(vehicleProfile as any)?.model} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} /></div></div>
        <div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.registration}</label><input name="regDate" type="date" defaultValue={vehicleProfile?.registrationDate} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} required /></div><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.lastItv}</label><input name="lastItv" type="date" defaultValue={vehicleProfile?.lastItvDate} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-blue-500 uppercase">{txt.serviceKm}</label><input name="lastServiceKm" type="number" defaultValue={vehicleProfile?.lastServiceKm} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} /></div><div><label className="text-[10px] font-bold text-blue-500 uppercase">{txt.serviceDate}</label><input name="lastServiceDate" type="date" defaultValue={vehicleProfile?.lastServiceDate} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`} /></div></div><div><label className="text-[10px] font-bold text-slate-500 uppercase">{txt.vehicleType}</label><select name="category" defaultValue={vehicleProfile?.category || 'turismo'} className={`w-full ${modalInput} border rounded-xl p-3 text-sm`}><option value="turismo">Turismo</option><option value="furgoneta">Furgoneta</option><option value="motocicleta">Moto</option></select></div></div><button type="submit" className={`w-full py-4 ${ecoBg} text-slate-900 rounded-xl font-bold uppercase text-xs`}>{txt.saveChanges}</button></form><div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 text-center"><button onClick={handleClearAllData} className="text-red-500 text-[10px] font-bold uppercase hover:text-red-400">{txt.deleteAll}</button></div></div></div>)}
      
      {/* 4. GUÍA DE AYUDA */}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} lang={lang} />}

      {/* 5. HISTORIAL (NUEVO MODAL) */}
      {showHistory && (
          <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
              <div className={`${modalBg} border border-slate-200 dark:border-white/10 w-full max-w-2xl p-0 rounded-3xl relative h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 shadow-2xl`}>
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
                      <h3 className={`text-lg font-black uppercase ${modalText} flex items-center gap-2`}><History size={20} className="text-blue-500"/> {txt.historyBtn}</h3>
                      <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} className="text-slate-500"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[9px] font-black uppercase text-slate-500 sticky top-0"><tr><th className="px-4 py-3">{txt.date}</th><th className="px-4 py-3 text-right">Odo.</th><th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-500">L/100</th><th className="px-4 py-3 text-right">#</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {calculatedEntries.slice().reverse().map((e: any) => (
                            <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white">{e.date}</td>
                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 font-mono-prec">{e.kmFinal.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-sm font-black text-emerald-600 dark:text-emerald-500 font-mono-prec">{e.consumption.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right"><button onClick={() => deleteEntry(e.id)} className="text-red-500 opacity-50 hover:opacity-100"><Trash2 size={14}/></button></td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
