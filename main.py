from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from deep_translator import GoogleTranslator
from gtts import gTTS
import os, threading, time, uuid

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

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

            # Registro inicial do idioma
            if data["type"] == "register":
                connected_users[user_id]["lang"] = data["lang"]
                await websocket.send_json({
                    "type": "system",
                    "msg": f"✅ Conectado — idioma: {data['lang']}"
                })
                continue

            # Mensagem de chat
            if data["type"] == "message":
                text = data["text"].strip()
                sender_lang = connected_users[user_id]["lang"]

                # Envia para todos os outros usuários
                for uid, info in connected_users.items():
                    if uid == user_id:
                        continue  # não enviar de volta para o próprio remetente

                    target_ws = info["socket"]
                    target_lang = info["lang"]

                    # Tradução
                    translated = GoogleTranslator(source=sender_lang, target=target_lang).translate(text)

                    # Gera áudio na língua do destinatário
                    audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"
                    tts = gTTS(translated, lang=target_lang)
                    tts.save(audio_file)

                    # Remove depois de 30 segundos
                    threading.Thread(
                        target=lambda f=audio_file: (time.sleep(30), os.remove(f) if os.path.exists(f) else None)
                    ).start()

                    # Envia mensagem formatada (original + tradução)
                    await target_ws.send_json({
                        "type": "translation",
                        "from": sender_lang,
                        "original": text,
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
