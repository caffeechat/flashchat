import { supabase, generateRoomCode, getUserId } from './supabase.js';

const welcomeScreen = document.getElementById('welcome-screen');
const chatScreen = document.getElementById('chat-screen');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnLeave = document.getElementById('btn-leave');
const btnSend = document.getElementById('btn-send');
const roomInput = document.getElementById('room-code-input');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const displayRoomCode = document.getElementById('display-room-code');

let currentRoomId = null;
let currentRoomCode = null;
const userId = getUserId();

// Crea Stanza
btnCreate.addEventListener('click', async () => {
  const code = generateRoomCode();
  const { data, error } = await supabase.from('rooms').insert([{ code }]).select().single();
  
  if (error) {
    alert('Errore creazione stanza: ' + error.message);
    return;
  }
  enterRoom(data.id, data.code);
});

// Entra in Stanza
btnJoin.addEventListener('click', async () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) return alert('Inserisci un codice!');

  const { data, error } = await supabase.from('rooms').select().eq('code', code).single();
  
  if (error || !data) {
    alert('Stanza non trovata!');
    return;
  }
  enterRoom(data.id, data.code);
});

// Entra nella schermata Chat
function enterRoom(id, code) {
  currentRoomId = id;
  currentRoomCode = code;
  displayRoomCode.innerText = code;
  welcomeScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');

  loadMessages();
  listenToNewMessages();
}

// Esci dalla Stanza
btnLeave.addEventListener('click', () => {
  location.reload();
});

// Carica Messaggi Vecchi
async function loadMessages() {
  const { data } = await supabase
    .from('messages')
    .select()
    .eq('room_id', currentRoomId)
    .order('created_at', { ascending: true });

  messagesContainer.innerHTML = '';
  if (data) data.forEach(renderMessage);
}

// Invia Messaggio
btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  messageInput.value = '';
  await supabase.from('messages').insert([{
    room_id: currentRoomId,
    sender_id: userId,
    content: text
  }]);
}

// Disegna messaggio a schermo
function renderMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('message');
  if (msg.sender_id === userId) div.classList.add('mine');
  div.innerText = msg.content;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Ascolta nuovi messaggi in Tempo Reale
function listenToNewMessages() {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      if (payload.new.room_id === currentRoomId) {
        renderMessage(payload.new);
      }
    })
    .subscribe();
}
