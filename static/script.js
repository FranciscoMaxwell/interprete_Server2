let ws;
let myLang = "pt";

function connect() {
  myLang = document.getElementById("myLang").value;
  ws = new WebSocket("wss://" + window.location.host + "/ws");

  ws.onopen = () => {
    addMessage("✅ Conectado! Idioma: " + myLang, "system");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("📩 Recebido:", data);

    if (data.type === "translation" && data.text) {
      addMessage("🗣 " + data.text, "other");

      // só toca áudio se existir
      if (data.audio) {
        const audio = new Audio(data.audio);
        audio.play().catch(err => console.warn("🔇 Erro ao reproduzir:", err));
      }
    }
  };

  ws.onclose = () => addMessage("🔌 Desconectado.", "system");
}

function sendMessage() {
  const input = document.getElementById("message");
  const msg = input.value.trim();

  if (msg && ws && ws.readyState === WebSocket.OPEN) {
    addMessage(msg, "me");
    ws.send(msg);
    input.value = "";
  }
}

function addMessage(text, type) {
  if (!text) return; // evita undefined
  const div = document.createElement("div");
  div.className = "msg " + type;
  div.textContent = text;
  document.getElementById("messages").appendChild(div);
  const chat = document.getElementById("messages");
  chat.scrollTop = chat.scrollHeight;
}

// reconhecimento de voz (opcional)
function startListening() {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Seu navegador não suporta reconhecimento de voz.");
    return;
  }

  const rec = new webkitSpeechRecognition();
  rec.lang = myLang;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById("message").value = text;
    sendMessage();
  };
  rec.start();
}
