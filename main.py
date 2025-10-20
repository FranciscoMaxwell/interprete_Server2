from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from deep_translator import GoogleTranslator
from gtts import gTTS
import os, threading, time, uuid

app = FastAPI()

# Servir os arquivos estáticos (CSS, JS, etc)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def home():
    """Serve o arquivo index.html principal"""
    return HTMLResponse(open("static/index.html", "r", encoding="utf-8").read())


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Canal de comunicação em tempo real"""
    await websocket.accept()
    print("🔗 Cliente conectado via WebSocket")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"📨 Recebido: {data}")

            # Traduz o texto
            translated = GoogleTranslator(source="auto", target="en").translate(data)

            # Gera um nome único para o arquivo de áudio
            audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"

            try:
                tts = gTTS(translated, lang="en")
                tts.save(audio_file)
            except Exception as e:
                print(f"⚠️ Erro ao gerar áudio: {e}")
                audio_file = None

            # 🧹 Thread para apagar o áudio após 30 segundos
            if audio_file:
                threading.Thread(
                    target=lambda f=audio_file: (
                        time.sleep(30),
                        os.remove(f) if os.path.exists(f) else None
                    )
                ).start()

            # Envia resposta ao cliente
            await websocket.send_json({
                "type": "translation",
                "text": translated,
                "audio": f"/{audio_file}" if audio_file else None
            })

    except WebSocketDisconnect:
        print("🔌 Cliente desconectado")
    except Exception as e:
        print(f"⚠️ Erro inesperado: {e}")
    finally:
        await websocket.close()
