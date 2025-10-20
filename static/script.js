let ws, myLang;

function connect() {
  myLang = document.getElementById("myLang").value;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "register", lang: myLang }));
    addMessage("✅ Conectado! Idioma: " + myLang, "system");

    // Envia pings automáticos a cada 25s para evitar desconexão
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "translation") {
      addMessage(`🗣 ${data.translated}`, "other");

      if (data.audio) {
        const audio = new Audio(data.audio);
        audio.play();
      }
    } else if (data.type === "system") {
      addMessage("⚙️ " + data.msg, "system");
    }
  };

  ws.onclose = () => addMessage("❌ Conexão encerrada.", "system");
}

function sendMessage() {
  const msg = document.getElementById("message").value.trim();
  if (!msg) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "message", text: msg }));
    addMessage(msg, "me");
    document.getElementById("message").value = "";
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

function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.textContent = text;
  document.getElementById("messages").appendChild(div);
  const chat = document.getElementById("messages");
  chat.scrollTop = chat.scrollHeight;
}
