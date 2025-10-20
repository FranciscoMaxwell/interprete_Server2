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

    // Mantém conexão ativa
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "translation") {
      // Mostra: original / tradução (traduzido em destaque)
      addMessage(data.name, data.original, data.translated, "other");

      // Toca áudio da tradução (somente para quem precisa ouvir)
      if (data.audio && data.lang === myLang) {
        const audio = new Audio(data.audio);
        audio.play();
      }
    } else if (data.type === "system") {
      addSystemMessage(data.msg);
    }
  };

  ws.onclose = () => addSystemMessage("❌ Conexão encerrada.");
}

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

// Exibe mensagens no chat
function addMessage(name, original, translated, who) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + who;

  const nameTag = `<div class="username">${name}</div>`;

  if (who === "me") {
    div.innerHTML = `${nameTag}<strong>${original}</strong>`;
  } else {
    // original mais opaco, tradução em destaque
    div.innerHTML = `
      ${nameTag}
      <span class="original">${original}</span><br>
      <span class="translated">${translated}</span>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Exibe mensagens do sistema
function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
}
