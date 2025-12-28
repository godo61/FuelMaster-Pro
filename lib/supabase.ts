
import { createClient } from '@supabase/supabase-js';

// En Vite, las variables de entorno se acceden vía import.meta.env
// Se recomienda usar el prefijo VITE_ en Vercel (ej: VITE_SUPABASE_URL)
const env = (import.meta as any).env;

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

// Detección de configuración válida
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder');

// Cliente de Supabase
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
