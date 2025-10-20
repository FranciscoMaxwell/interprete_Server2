from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from deep_translator import GoogleTranslator
from gtts import gTTS
import os, threading, time, uuid

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

# Guarda as conexões ativas e idiomas de cada usuário
connected_users = {}

@app.get("/")
async def home():
    return HTMLResponse(open("static/index.html", "r", encoding="utf-8").read())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = uuid.uuid4().hex[:8]
    connected_users[user_id] = {"socket": websocket, "lang": "en"}
    print(f"🔗 Usuário {user_id} conectado")

    try:
        while True:
            data = await websocket.receive_json()

            # Tipo: registro inicial
            if data["type"] == "register":
                connected_users[user_id]["lang"] = data["lang"]
                await websocket.send_json({
                    "type": "system",
                    "msg": f"Conectado com idioma {data['lang']} ✅"
                })
                continue

            # Tipo: mensagem enviada
            if data["type"] == "message":
                text = data["text"]
                sender_lang = connected_users[user_id]["lang"]

                # Envia para todos os outros usuários conectados
                for uid, info in connected_users.items():
                    target_ws = info["socket"]
                    target_lang = info["lang"]

                    # Traduz texto para o idioma do outro usuário
                    translated = GoogleTranslator(source=sender_lang, target=target_lang).translate(text)

                    # Cria áudio
                    audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"
                    tts = gTTS(translated, lang=target_lang)
                    tts.save(audio_file)

                    # Apaga depois de 30s
                    threading.Thread(
                        target=lambda f=audio_file: (time.sleep(30), os.remove(f) if os.path.exists(f) else None)
                    ).start()

                    await target_ws.send_json({
                        "type": "translation",
                        "from": sender_lang,
                        "translated": translated,
                        "audio": f"/{audio_file}"
                    })

    except WebSocketDisconnect:
        print(f"❌ Usuário {user_id} desconectado")
    except Exception as e:
        print("⚠️ Erro:", e)
    finally:
        connected_users.pop(user_id, None)
        await websocket.close()
