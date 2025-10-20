let ws, myLang, username;

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

    // Mantém conexão viva
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "translation") {
      // Mensagens de texto
      if (data.file) {
        // Mensagem com arquivo
        addFileMessage(data.name, data.file, data.fileName, data.mimeType, "other");
      } else {
        if (data.original.trim().toLowerCase() === data.translated.trim().toLowerCase()) {
          addMessage(data.name, data.original, null, "other");
        } else {
          addMessage(data.name, data.original, data.translated, "other");
        }
      }

      // Áudio de tradução automática
      if (data.audio && data.lang === myLang) {
        const audio = new Audio(data.audio);
        audio.play().catch(() => {});
      }
    } else if (data.type === "file") {
      // Arquivo direto sem tradução
      addFileMessage(data.name, data.file, data.fileName, data.mimeType, "other");
    } else if (data.type === "system") {
      addSystemMessage(data.msg);
    }
  };

  ws.onclose = () => addSystemMessage("❌ Conexão encerrada.");
}

/* === Envio de mensagens de texto === */
function sendMessage() {
  const input = document.getElementById("message");
  const msg = input.value.trim();
  if (!msg) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "message", text: msg, name: username }));
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
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    ja: "ja-JP"
  };
  return map[code] || "en-US";
}

/* === Exibe mensagens de texto === */
function addMessage(name, original, translated, who) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + who;

  const nameTag = `<div class="username">${name}</div>`;

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

/* === Exibe mensagens de arquivos === */
function addFileMessage(name, base64, fileName, mimeType, who) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + who;

  const nameTag = `<div class="username">${name}</div>`;
  let content = "";

  if (mimeType.startsWith("image/")) {
    content = `<div class="file-preview"><img src="${base64}" alt="${fileName}"></div>`;
  } else if (mimeType.startsWith("video/")) {
    content = `<div class="file-preview"><video controls src="${base64}"></video></div>`;
  } else if (mimeType.startsWith("audio/")) {
    content = `<div class="file-preview"><audio controls src="${base64}"></audio></div>`;
  } else {
    content = `
      <div class="file-preview">
        📎 ${fileName}<br>
        <a href="${base64}" download="${fileName}" class="download-btn">Baixar</a>
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
