

import { createClient } from '@supabase/supabase-js';

/**
 * IMPORTANTE: Para que la sincronización funcione, ejecuta este SQL en tu panel de Supabase:
 * 
 * create table fuel_entries (
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

// Vite utiliza import.meta.env para las variables de entorno en el cliente
// Fix: Access env properties through type assertion to resolve TypeScript errors on lines 27 and 28
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);