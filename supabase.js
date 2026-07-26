import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://duddogkjpkojlvhazswf.supabase.co';
const supabaseKey = 'sb_publishable_UB-MxEcMZrA55ZZEOLzTIA_toqD1x-r';

export const supabase = createClient(supabaseUrl, supabaseKey);

export function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getUserId() {
  let id = localStorage.getItem('chatlampo_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatlampo_user_id', id);
  }
  return id;
}
