from fastapi import FastAPI, WebSocket
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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("🔗 Cliente conectado via WebSocket")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"📨 Recebido: {data}")

            # Traduz automaticamente para inglês (exemplo)
            translated = GoogleTranslator(source='auto', target='en').translate(data)

            # Gera um nome único para o arquivo de áudio
            audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"

            # Cria e salva o áudio
            tts = gTTS(translated, lang='en')
            tts.save(audio_file)

            # 🧹 Cria thread para apagar o áudio depois de 30 segundos
            threading.Thread(
                target=lambda: (
                    time.sleep(30),
                    os.remove(audio_file) if os.path.exists(audio_file) else None
                )
            ).start()

            # Envia o texto traduzido e o caminho do áudio
            await websocket.send_json({
                "type": "translation",
                "text": translated,
                "audio": f"/{audio_file}"
            })

    except Exception as e:
        print("⚠️ Erro:", e)
    finally:
        await websocket.close()
        print("🔌 Cliente desconectado")
