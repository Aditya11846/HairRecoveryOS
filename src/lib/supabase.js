import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://zfmpbhtpytaoprxrzujv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbXBiaHRweXRhb3ByeHJ6dWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDI2MDUsImV4cCI6MjA5Njc3ODYwNX0.j8w5QVbIXI146OXvXreYjItyzJyr2VHZ4lW53vmwtn4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
