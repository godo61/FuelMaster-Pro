
import { createClient } from '@supabase/supabase-js';

// Función para obtener variables de forma segura en cualquier entorno
const getEnv = (key: string): string => {
  try {
    return (typeof process !== 'undefined' && process.env) ? (process.env[key] || '') : '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

// Detección mejorada
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder');

// Cliente con valores de respaldo para evitar errores de inicialización
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
