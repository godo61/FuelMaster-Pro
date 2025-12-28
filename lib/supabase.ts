
import { createClient } from '@supabase/supabase-js';

// Se utiliza process.env para acceder a las variables de entorno, siguiendo las guías del proyecto
// y solucionando los errores de tipos de TypeScript asociados a import.meta.env.
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Inicialización del cliente de Supabase
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
