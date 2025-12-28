import { createClient } from '@supabase/supabase-js';

/**
 * IMPORTANTE: Para que la sincronización funcione, ejecuta este SQL en tu panel de Supabase:
 * 
 * create table if not exists fuel_entries (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users not null,
 *   date text not null,
 *   km_inicial numeric not null,
 *   km_final numeric not null,
 *   fuel_amount numeric not null,
 *   price_per_liter numeric not null,
 *   cost numeric not null,
 *   distancia numeric not null,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * alter table fuel_entries enable row level security;
 * 
 * create policy "Users can manage their own entries"
 *   on fuel_entries for all
 *   using (auth.uid() = user_id);
 */

// Función segura para obtener variables de entorno sin lanzar TypeErrors
const getEnv = (key: string): string => {
  try {
    // 1. Intentar import.meta.env (Vite / ESM moderno)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key];
      if (val) return val;
    }
  } catch (e) {}

  try {
    // 2. Intentar process.env (Node / Entornos Sandbox)
    if (typeof process !== 'undefined' && process && process.env) {
      const val = (process.env as any)[key];
      if (val) return val;
    }
  } catch (e) {}

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Verificación de configuración válida
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('placeholder') &&
  !!supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder';

// Solo inicializar si es válido para evitar errores de red inmediatos (Failed to fetch)
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://invalid-config.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'invalid-key'
);
