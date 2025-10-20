let ws, myLang;

function connect() {
  myLang = document.getElementById("myLang").value;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "register", lang: myLang }));
    addSystemMessage(`✅ Conectado! Idioma: ${myLang}`);

    // Ping automático para evitar desconexão
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "translation") {
      // Exibe: "original / tradução" com destaque
      addMessage(`${data.original}`, `${data.translated}`, "other");

      // Reproduz o áudio só na língua traduzida
      if (data.audio) {
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
    ws.send(JSON.stringify({ type: "message", text: msg }));
    addMessage(msg, null, "me");
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

function addMessage(original, translated, who) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg " + who;

  if (who === "me") {
    // Apenas o texto que eu escrevi, sem tradução
    div.innerHTML = `<strong>${original}</strong>`;
  } else {
    // Mostra original + tradução, sendo a tradução em destaque
    div.innerHTML = `
      <span style="opacity:0.6;">${original}</span><br>
      <strong>${translated}</strong>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  document.getElementById("messages").appendChild(div);
}
