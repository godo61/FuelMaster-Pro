
import { createClient } from '@supabase/supabase-js';

// En producción (Vercel/Netlify), estas variables se leen de Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Verificación estricta para mostrar o no la pantalla de configuración
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder-project.supabase.co' &&
  !supabaseUrl.includes('missing-url');

// Inicialización segura
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
