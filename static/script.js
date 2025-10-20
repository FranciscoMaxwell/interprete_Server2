let ws, myLang, username;
// conjunto para evitar duplicatas exibidas
const displayedIds = new Set();

function connect() {
  username = document.getElementById("username").value.trim();
  myLang = document.getElementById("myLang").value;

  if (!username) {
    alert("Digite um nome antes de conectar!");
    return;
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "register", lang: myLang, name: username }));
    addSystemMessage(`✅ Conectado como ${username} (${myLang.toUpperCase()})`);

    // Mantém a conexão viva
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 25000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Se vier com id e já exibimos, ignorar
    if (data.id && displayedIds.has(data.id)) return;

    if (data.type === "translation") {
      // marca como exibido
      if (data.id) displayedIds.add(data.id);

      // texto / tradução
      if (data.original && data.translated) {
        if (data.original.trim().toLowerCase() === data.translated.trim().toLowerCase()) {
          addMessage(data.name, data.original, null, "other");
        } else {
          addMessage(data.name, data.original, data.translated, "other");
        }
      }

      // toca áudio - preferir audio_data (in-memory) se existir
      if (data.audio_data) {
        try {
          const audio = new Audio(data.audio_data);
          audio.play().catch(() => {});
        } catch (e) { /* ignora */ }
      } else if (data.audio) {
        try {
          const audio = new Audio(data.audio);
          audio.play().catch(() => {});
        } catch (e) {}
      }

    } else if (data.type === "file") {
      // marca e evita duplicata
      if (data.id) displayedIds.add(data.id);

      // o servidor envia "file" como link (file) e fileName/mimeType
      addFileMessage(data.name, data.file, data.fileName, data.mimeType, "other");
    } else if (data.type === "system") {
      addSystemMessage(data.msg);
    }
  };

  ws.onclose = () => addSystemMessage("❌ Conexão encerrada.");
}

/* === Envio de mensagens === */
function sendMessage() {
  const input = document.getElementById("message");
  const msg = input.value.trim();
  if (!msg) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    // gera id cliente para identificar localmente (opcional)
    const localId = crypto ? (crypto.getRandomValues(new Uint32Array(1))[0].toString(16)) : Date.now().toString(16);
    // enviar
    ws.send(JSON.stringify({ type: "message", text: msg, name: username, clientId: localId }));
    addMessage(username, msg, null, "me");
    input.value = "";
  } else {
    alert("Conecte primeiro!");
  }
}

/* === Envio de arquivos === */
function sendFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "file",
        name: username,
        file: base64,
        fileName: file.name,
        mimeType: file.type
      }));
      // exibe localmente
      addFileMessage(username, base64, file.name, file.type, "me");
    } else {
      alert("Conecte primeiro!");
    }
  };
  reader.readAsDataURL(file);
}

/* === Reconhecimento de voz === */
function startListening() {
  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  rec.lang = mapLang(myLang);
  rec.start();

  rec.onresult = (e) => {
    const txt = e.results[0][0].transcript;
    document.getElementById("message").value = txt;
    sendMessage();
  };
}

function mapLang(code) {
  const map = {
    pt: "pt-BR", en: "en-US", es: "es-ES",
    fr: "fr-FR", de: "de-DE", it: "it-IT", ja: "ja-JP"
  };
  return map[code] || "en-US";
}

/* === Mensagens de texto === */
function addMessage(name, original, translated, who) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + who;

  // nome com reflexo (data-text) - usa classe reflected se quiser
  const nameTag = who === "me"
    ? `<div class="username"><strong>${name}</strong></div>`
    : `<div class="username reflected" data-text="${name}"><strong>${name}</strong></div>`;

  if (who === "me") {
    div.innerHTML = `${nameTag}<strong>${original}</strong>`;
  } else {
    if (translated) {
      div.innerHTML = `
        ${nameTag}
        <span class="original">${original}</span><br>
        <span class="translated"><strong>${translated}</strong></span>
      `;
    } else {
      div.innerHTML = `${nameTag}<strong>${original}</strong>`;
    }
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/* === Mensagens de arquivos === */
function addFileMessage(name, fileUrlOrBase64, fileName, mimeType, who) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + who;

  const nameTag = who === "me"
    ? `<div class="username"><strong>${name}</strong></div>`
    : `<div class="username reflected" data-text="${name}"><strong>${name}</strong></div>`;

  let content = "";

  // Se o servidor enviou um link (começa com "/static" por ex), usa-o; se veio base64, também funciona
  if (mimeType && mimeType.startsWith("image/")) {
    content = `<div class="file-preview"><img src="${fileUrlOrBase64}" alt="${fileName}"></div>`;
  } else if (mimeType && mimeType.startsWith("video/")) {
    content = `<div class="file-preview"><video controls src="${fileUrlOrBase64}"></video></div>`;
  } else if (mimeType && mimeType.startsWith("audio/")) {
    content = `<div class="file-preview"><audio controls src="${fileUrlOrBase64}"></audio></div>`;
  } else {
    // genérico: mostra link de download
    content = `
      <div class="file-preview">
        📎 ${fileName}<br>
        <a href="${fileUrlOrBase64}" download="${fileName}" class="download-btn">Baixar</a>
      </div>
    `;
  }

  div.innerHTML = `${nameTag}${content}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/* === Mensagem do sistema === */
function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop =
    document.getElementById("messages").scrollHeight;
}
