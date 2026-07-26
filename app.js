document.addEventListener('DOMContentLoaded', () => {
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const btnLeave = document.getElementById('btn-leave');
  const btnSend = document.getElementById('btn-send');
  const btnAttach = document.getElementById('btn-attach');

  const roomCodeInput = document.getElementById('room-code-input');
  const messageInput = document.getElementById('message-input');
  const imageInput = document.getElementById('image-input');

  const introScreen = document.getElementById('intro-screen');
  const chatScreen = document.getElementById('chat-screen');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const messagesContainer = document.getElementById('messages');

  const userId = 'user_' + Math.random().toString(36).substring(2, 9);
  let currentRoomId = null;
  let realtimeSubscription = null;

  // Gestione pulsante Fotocamera / Galleria
  if (btnAttach) {
    btnAttach.addEventListener('click', () => imageInput.click());
  }

  if (imageInput) {
    imageInput.addEventListener('change', async () => {
      const file = imageInput.files[0];
      if (!file || !currentRoomId) return;

      btnAttach.innerText = '⏳';

      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('chat-photos')
        .upload(fileName, file);

      if (error) {
        alert('Errore invio foto: ' + error.message);
        btnAttach.innerText = '📷';
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-photos')
        .getPublicUrl(fileName);

      await supabase.from('messages').insert([{
        room_id: currentRoomId,
        sender_id: userId,
        content: `[IMG]${publicUrlData.publicUrl}`
      }]);

      imageInput.value = '';
      btnAttach.innerText = '📷';
    });
  }

  // Crea Stanza
  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      try {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data, error } = await supabase.from('rooms').insert([{ code }]).select().single();

        if (error) {
          alert('Errore creazione stanza: ' + error.message);
          return;
        }
        enterRoom(data.id, data.code);
      } catch (err) {
        alert('Errore imprevisto: ' + err.message);
      }
    });
  }

  // Entra in Stanza
  if (btnJoin) {
    btnJoin.addEventListener('click', async () => {
      const code = roomCodeInput.value.trim().toUpperCase();
      if (!code) return alert('Inserisci un codice!');

      const { data, error } = await supabase.from('rooms').select().eq('code', code).single();

      if (error || !data) return alert('Stanza non trovata!');
      enterRoom(data.id, data.code);
    });
  }

  // Entra nella schermata chat
  function enterRoom(roomId, code) {
    currentRoomId = roomId;
    roomCodeDisplay.innerText = code;
    introScreen.style.display = 'none';
    chatScreen.style.display = 'flex';

    loadMessages();
    listenToMessages();
  }

  // Esci dalla chat
  if (btnLeave) {
    btnLeave.addEventListener('click', () => {
      if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
      currentRoomId = null;
      messagesContainer.innerHTML = '';
      chatScreen.style.display = 'none';
      introScreen.style.display = 'flex';
    });
  }

  // Invia Messaggio
  if (btnSend) {
    btnSend.addEventListener('click', sendMessage);
  }
  
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoomId) return;

    messageInput.value = '';
    await supabase.from('messages').insert([{
      room_id: currentRoomId,
      sender_id: userId,
      content: text
    }]);
  }

  // Carica messaggi esistenti
  async function loadMessages() {
    const { data } = await supabase.from('messages').select().eq('room_id', currentRoomId).order('created_at', { ascending: true });
    messagesContainer.innerHTML = '';
    if (data) data.forEach(renderMessage);
  }

  // Ascolta nuovi messaggi
  function listenToMessages() {
    realtimeSubscription = supabase
      .channel('room-' + currentRoomId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` }, (payload) => {
        renderMessage(payload.new);
      })
      .subscribe();
  }

  // Mostra messaggio o immagine a schermo
  function renderMessage(msg) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(msg.sender_id === userId ? 'mine' : 'theirs');

    if (msg.content.startsWith('[IMG]')) {
      const imgUrl = msg.content.replace('[IMG]', '');
      div.innerHTML = `<img src="${imgUrl}" alt="foto">`;
    } else {
      div.innerText = msg.content;
    }

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
});
