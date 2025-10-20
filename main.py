from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from deep_translator import GoogleTranslator
from gtts import gTTS
import os, threading, time, uuid

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def home():
    return HTMLResponse(open("static/index.html", "r", encoding="utf-8").read())

# Lista de clientes conectados
clients = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user = {"ws": websocket, "lang": "en"}  # idioma padrão
    clients.append(user)
    print("🔗 Cliente conectado.")

    try:
        while True:
            data = await websocket.receive_json()

            # Registro do idioma
            if data["type"] == "register":
                user["lang"] = data["lang"]
                await websocket.send_json({
                    "type": "system",
                    "msg": f"✅ Conectado! Idioma: {user['lang']}"
                })
                continue

            # Mensagem enviada por um usuário
            if data["type"] == "message":
                text = data["text"]

                for c in clients:
                    if c != user:
                        # Tradução cruzada: envia no idioma do outro
                        translated = GoogleTranslator(
                            source=user["lang"], target=c["lang"]
                        ).translate(text)

                        # Cria áudio
                        audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"
                        try:
                            gTTS(translated, lang=c["lang"]).save(audio_file)
                        except Exception as e:
                            print("⚠️ Erro ao gerar áudio:", e)
                            audio_file = None

                        # Remove áudio depois de 30s
                        threading.Thread(target=lambda: (
                            time.sleep(30),
                            os.remove(audio_file) if audio_file and os.path.exists(audio_file) else None
                        )).start()

                        await c["ws"].send_json({
                            "type": "translation",
                            "from": user["lang"],
                            "text": translated,
                            "audio": f"/{audio_file}" if audio_file else None
                        })

    except WebSocketDisconnect:
        print("🔌 Cliente desconectado")
        clients.remove(user)
