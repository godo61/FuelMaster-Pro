import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// PASO OBLIGATORIO:
// Sustituye las comillas vacías '' con tus claves de Supabase.
// Las encuentras en: supabase.com -> Tu Proyecto -> Settings -> API
// ------------------------------------------------------------------

const supabaseUrl: string = 'https://rcusaynnqiawzozsmgjp.supabase.co'; 
// Ejemplo: 'https://xyzxyzxyz.supabase.co'

const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjdXNheW5ucWlhd3pvenNtZ2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTE1NjksImV4cCI6MjA4MjQ4NzU2OX0.W-GEbSERy1hCWoMLRTpCKjwR2V_JvWzkZ-jcVZx4NFI'; 
// Ejemplo: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// ------------------------------------------------------------------

// Función auxiliar para validar que has puesto algo
const isValidConfig = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
};

// Evitamos que la app explote si las claves están vacías
const urlToUse = isValidConfig() ? supabaseUrl : 'https://placeholder.supabase.co';
const keyToUse = isValidConfig() ? supabaseAnonKey : 'placeholder';

export const supabase = createClient(urlToUse, keyToUse);

export const isSupabaseConfigured = isValidConfig();