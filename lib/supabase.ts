import { createClient } from '@supabase/supabase-js';

// Función segura para obtener variables de entorno en Vite
const getEnvVar = (name: string): string => {
  try {
    // @ts-ignore - Acceso estándar en Vite
    return import.meta.env[name] || '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL') || '';
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') || '';

// Detección de configuración válida
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder');

// Cliente de Supabase
// Si no está configurado, usamos placeholders para evitar que el SDK de Supabase lance un error inmediato
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);