from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from deep_translator import GoogleTranslator
from gtts import gTTS
import os, threading, time, uuid, base64

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
    connected_users[user_id] = {"socket": websocket, "lang": "en", "name": "Usuário"}
    print(f"🔗 Usuário {user_id} conectado")

    try:
        while True:
            data = await websocket.receive_json()

            # --- Registro inicial do idioma e nome ---
            if data["type"] == "register":
                connected_users[user_id]["lang"] = data.get("lang", "en")
                connected_users[user_id]["name"] = data.get("name", f"User-{user_id[:4]}")
                await websocket.send_json({
                    "type": "system",
                    "msg": f"✅ Conectado como {connected_users[user_id]['name']} ({connected_users[user_id]['lang']})"
                })
                continue

            # --- Mantém conexão viva ---
            if data["type"] == "ping":
                continue

            # --- Mensagem de chat ---
            if data["type"] == "message":
                await handle_text_message(user_id, data["text"])

            # --- Envio de arquivo ---
            if data["type"] == "file":
                await handle_file_message(user_id, data)

    except WebSocketDisconnect:
        print(f"❌ Usuário {user_id} desconectado")
    except Exception as e:
        print("⚠️ Erro:", e)
    finally:
        connected_users.pop(user_id, None)
        await websocket.close()


# -------------------------------------------------------------------
# 📘 LIDA COM MENSAGENS DE TEXTO
# -------------------------------------------------------------------
async def handle_text_message(user_id, text):
    sender = connected_users[user_id]
    sender_lang = sender["lang"]
    sender_name = sender["name"]

    for uid, info in connected_users.items():
        if uid == user_id:
            continue  # não envia para si mesmo

        target_ws = info["socket"]
        target_lang = info["lang"]

        # Tradução automática
        translated = GoogleTranslator(source=sender_lang, target=target_lang).translate(text)

        # Gera áudio no idioma do destinatário
        audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"
        try:
            tts = gTTS(translated, lang=target_lang)
            tts.save(audio_file)

            # Remove o arquivo depois de 30 segundos
            threading.Thread(
                target=lambda f=audio_file: (time.sleep(30), os.remove(f) if os.path.exists(f) else None)
            ).start()
        except Exception:
            audio_file = None

        # Envia tradução
        await target_ws.send_json({
            "type": "translation",
            "from": sender_lang,
            "original": text,
            "translated": translated,
            "audio": f"/{audio_file}" if audio_file else None,
            "name": sender_name
        })


# -------------------------------------------------------------------
# 📁 LIDA COM ENVIO DE ARQUIVOS (IMAGENS, VÍDEOS, ETC.)
# -------------------------------------------------------------------
async def handle_file_message(user_id, data):
    sender = connected_users[user_id]
    sender_name = sender["name"]

    file_name = data.get("fileName", f"arquivo_{uuid.uuid4().hex[:6]}")
    mime = data.get("mime", "application/octet-stream")
    base64_data = data.get("data")

    # Decodifica base64 e salva o arquivo em static/uploads/
    os.makedirs("static/uploads", exist_ok=True)
    file_ext = os.path.splitext(file_name)[1] or ".bin"
    file_path = f"static/uploads/{uuid.uuid4().hex[:8]}{file_ext}"

    try:
        header, encoded = base64_data.split(",", 1)
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(encoded))
    except Exception as e:
        print("Erro ao salvar arquivo:", e)
        return

    # Envia o link do arquivo a todos os usuários conectados
    for uid, info in connected_users.items():
        try:
            await info["socket"].send_json({
                "type": "file",
                "name": sender_name,
                "file_name": file_name,
                "file_url": f"/{file_path}",
                "mime": mime
            })
        except Exception as e:
            print("Erro ao enviar arquivo:", e)
