
import { createClient } from '@supabase/supabase-js';

// Intentamos capturar las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Verificamos si están presentes
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'https://missing-url.supabase.co';

// Inicializamos con fallbacks seguros para evitar errores de construcción
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
