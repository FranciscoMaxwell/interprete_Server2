from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from deep_translator import GoogleTranslator
from gtts import gTTS
import os, threading, time, uuid, base64, io

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

    for uid, info in list(connected_users.items()):
        if uid == user_id:
            continue  # não envia para si mesmo

        target_ws = info["socket"]
        target_lang = info["lang"]

        # Tradução automática
        try:
            translated = GoogleTranslator(source=sender_lang, target=target_lang).translate(text)
        except Exception as e:
            print("Erro na tradução:", e)
            translated = text

        # --- Gera áudio em memória (data URL) ---
        audio_data_url = None
        try:
            tts = gTTS(translated, lang=target_lang)
            bio = io.BytesIO()
            tts.write_to_fp(bio)
            bio.seek(0)
            audio_b64 = base64.b64encode(bio.read()).decode("utf-8")
            audio_data_url = f"data:audio/mp3;base64,{audio_b64}"
        except Exception as e:
            print("⚠️ Erro ao gerar áudio:", e)
            audio_data_url = None

        # --- Mantém compatibilidade com o antigo sistema de arquivos ---
        audio_file = f"static/audio_{uuid.uuid4().hex[:8]}.mp3"
        try:
            if audio_data_url:
                with open(audio_file, "wb") as f:
                    header, b64 = audio_data_url.split(",", 1)
                    f.write(base64.b64decode(b64))
                threading.Thread(
                    target=lambda f=audio_file: (time.sleep(30), os.remove(f) if os.path.exists(f) else None)
                ).start()
        except Exception as e:
            print("Erro ao salvar áudio:", e)
            audio_file = None

        # --- Envia tradução + áudio ---
        await target_ws.send_json({
            "type": "translation",
            "from": sender_lang,
            "original": text,
            "translated": translated,
            "audio": f"/{audio_file}" if audio_file else None,
            "audio_data": audio_data_url,
            "name": sender_name
        })


# -------------------------------------------------------------------
# 📁 LIDA COM ENVIO DE ARQUIVOS (IMAGENS, VÍDEOS, ETC.)
# -------------------------------------------------------------------
# -------------------------------------------------------------------
# 📁 LIDA COM ENVIO DE ARQUIVOS (IMAGENS, VÍDEOS, ÁUDIOS, ETC.) — com id
# -------------------------------------------------------------------
async def handle_file_message(user_id, data):
    sender = connected_users[user_id]
    sender_name = sender["name"]

    # aceitar os campos enviados pelo JS
    file_name = data.get("fileName", f"arquivo_{uuid.uuid4().hex[:6]}")
    mime_type = data.get("mimeType", "application/octet-stream")
    base64_data = data.get("file")  # vem como dataURL: data:image/png;base64,...

    # criar pasta e salvar
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

    # id único para o arquivo (para deduplicação)
    msg_id = uuid.uuid4().hex

    # Envia para todos os outros (não para o remetente)
    for uid, info in list(connected_users.items()):
        try:
            if uid == user_id:
                continue
            await info["socket"].send_json({
                "type": "file",
                "id": msg_id,
                "name": sender_name,
                "file": f"/{file_path}",
                "fileName": file_name,
                "mimeType": mime_type
            })
        except Exception as e:
            print("Erro ao enviar arquivo para", uid, ":", e)
