document.addEventListener('DOMContentLoaded', () => {
  const btnPublic = document.getElementById('btn-public');
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const btnLeave = document.getElementById('btn-leave');
  const btnSend = document.getElementById('btn-send');

  const btnCamera = document.getElementById('btn-camera');
  const btnGallery = document.getElementById('btn-gallery');
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');

  const roomCodeInput = document.getElementById('room-code-input');
  const messageInput = document.getElementById('message-input');

  const introScreen = document.getElementById('intro-screen');
  const chatScreen = document.getElementById('chat-screen');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const messagesContainer = document.getElementById('messages');

  const userId = 'user_' + Math.random().toString(36).substring(2, 9);
  let currentRoomId = null;
  let realtimeSubscription = null;

  // Gestione bottoni Foto
  if (btnCamera && cameraInput) btnCamera.addEventListener('click', () => cameraInput.click());
  if (btnGallery && galleryInput) btnGallery.addEventListener('click', () => galleryInput.click());

  // Caricamento Immagine
  async function handleImageUpload(inputElement, buttonElement, defaultIcon) {
    const file = inputElement.files[0];
    if (!file || !currentRoomId) return;

    buttonElement.innerText = '⏳';

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('chat-photos')
      .upload(fileName, file);

    if (error) {
      alert('Errore caricamento foto: ' + error.message);
      buttonElement.innerText = defaultIcon;
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

    inputElement.value = '';
    buttonElement.innerText = defaultIcon;
  }

  if (cameraInput) cameraInput.addEventListener('change', () => handleImageUpload(cameraInput, btnCamera, '📷'));
  if (galleryInput) galleryInput.addEventListener('change', () => handleImageUpload(galleryInput, btnGallery, '🖼️'));

  // Chat Pubblica
  if (btnPublic) {
    btnPublic.addEventListener('click', async () => {
      let { data } = await supabase.from('rooms').select('*').eq('code', 'PUBBLICA').maybeSingle();
      if (!data) {
        const { data: newRoom } = await supabase.from('rooms').insert([{ code: 'PUBBLICA' }]).select().single();
        data = newRoom;
      }
      enterRoom(data.id, 'PUBBLICA');
    });
  }

  // Stanza Privata
  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data } = await supabase.from('rooms').insert([{ code }]).select().single();
      if (data) enterRoom(data.id, data.code);
    });
  }

  if (btnJoin) {
    btnJoin.addEventListener('click', async () => {
      const code = roomCodeInput.value.trim().toUpperCase();
      if (!code) return alert('Inserisci un codice!');

      const { data } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle();
      if (!data) return alert('Stanza non trovata!');
      enterRoom(data.id, data.code);
    });
  }

  function enterRoom(roomId, code) {
    currentRoomId = roomId;
    roomCodeDisplay.innerText = code;
    introScreen.style.display = 'none';
    chatScreen.style.display = 'flex';

    loadMessages();
    listenToMessages();
  }

  if (btnLeave) {
    btnLeave.addEventListener('click', () => {
      if (realtimeSubscription) supabase.removeChannel(realtimeSubscription);
      currentRoomId = null;
      messagesContainer.innerHTML = '';
      chatScreen.style.display = 'none';
      introScreen.style.display = 'flex';
    });
  }

  if (btnSend) btnSend.addEventListener('click', sendMessage);
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

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoomId)
      .order('created_at', { ascending: true });

    messagesContainer.innerHTML = '';
    if (data) data.forEach(renderMessage);
  }

  function listenToMessages() {
    realtimeSubscription = supabase
      .channel('room-' + currentRoomId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` }, (payload) => {
        renderMessage(payload.new);
      })
      .subscribe();
  }

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
