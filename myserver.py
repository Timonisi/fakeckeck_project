import json
import re
import hmac
import base64
import os
from datetime import datetime, date

import vk_api
import pandas as pd
import joblib
import requests

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware


VK_TOKEN = os.getenv("VK_TOKEN", "").strip()
VK_APP_SECRET = os.getenv("VK_APP_SECRET", "").strip()

if not VK_TOKEN or VK_TOKEN.lower() in {"token", "changeme"}:
    raise RuntimeError("VK_TOKEN is not configured. Set VK_TOKEN env var.")
if not VK_APP_SECRET or VK_APP_SECRET.lower() in {"secret", "changeme"}:
    raise RuntimeError("VK_APP_SECRET is not configured. Set VK_APP_SECRET env var.")
SUBSCRIPTION_STATUS_URL = os.getenv(
    "SUBSCRIPTION_STATUS_URL",
    "https://customqr.pythonanywhere.com/subscription/status",
)
UNLIMITED_ATTEMPTS = 10 ** 9


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
    max_age=3600,
)


model = joblib.load("best_fake_real_classifier.pkl")

ATTEMPTS_FILE = "attempts.json"
DAILY_ATTEMPTS = 3

feature_translation = {
    "about_length": "Раздел 'О себе'",
    "activities_length": "Раздел 'Деятельность'",
    "books_length": "Раздел 'Книги'",
    "games_length": "Раздел 'Игры'",
    "movies_length": "Раздел 'Фильмы'",
    "music_length": "Раздел 'Музыка'",
    "quotes_length": "Раздел 'Цитаты'",
    "tv_length": "Раздел 'Телешоу'",
    "has_universities": "Наличие информации об университете",
    "has_schools": "Наличие информации о школе",
    "city": "Город",
    "albums": "Количество альбомов",
    "audios": "Количество аудиозаписей",
    "followers": "Количество подписчиков",
    "friends": "Количество друзей",
    "gifts": "Количество подарков",
    "pages": "количество объектов в блоке «Интересные страницы»",
    "photos": "Количество фотографий",
    "subscriptions": "Количество подписок",
    "videos": "Количество видеозаписей",
    "video_playlists": "Количество видеоплейлистов",
    "clips_followers": "Количество подписчиков на клипы",
    "clips_views": "Количество просмотров клипов",
    "clips_likes": "Количество лайков на клипах",
    "year": "Дата первой публикации",
    "followers_count": "Количество подписчиков",
    "has_personal": "Наличие личной информации",
    "has_relatives": "Наличие родственников",
    "has_occupation": "Наличие работы",
    "relation": "Статус отношений",
    "groups_count": "Количество групп",
    "status_update_frequency": "Частота обновления статуса",
    "has_numbers": "Наличие цифр в статусе",
    "status_length": "Раздел 'Статус'",
    "hashtags_count": "Количество хэштегов",
}

feature_values = {
    'about_length': 0.0,
    'activities_length': 0.0,
    'books_length': 0.0,
    'games_length': 0.0,
    'movies_length': 0.0,
    'music_length': 0.0,
    'quotes_length': 0.0,
    'tv_length': 0.0,
    'has_universities': 0.0,
    'has_schools': 0.0,
    'city': 1.0,
    'albums': 0.0,
    'audios': 0.0,
    'followers': 25.0,
    'friends': 87.0,
    'gifts': 0.0,
    'pages': 27.5,
    'photos': 7.0,
    'subscriptions': 1.0,
    'videos': 1.0,
    'video_playlists': 0.0,
    'clips_followers': 135.0,
    'clips_views': 0.0,
    'clips_likes': 0.0,
    'year': 2015.0,
    'followers_count': 135.5,
    'has_personal': 0.0,
    'has_relatives': 1.0,
    'has_occupation': 0.0,
    'relation': 0.0,
    'groups_count': 38.0,
    'status_update_frequency': 9.0,
    'has_numbers': 0.0,
    'status_length': 0.0,
    'hashtags_count': 0.0,
}


def get_user_id(username, vk):
    response = vk.users.get(user_ids=username)
    return int(response[0]['id'])


def is_account_closed(user_id, access_token):
    """
    Проверяет, закрыт ли аккаунт ВКонтакте
    :param user_id: ID пользователя
    :param access_token: токен доступа VK API
    :return: True если аккаунт закрыт, False если открыт, None при ошибке
    """
    try:
        vk_session = vk_api.VkApi(token=access_token)
        vk = vk_session.get_api()

        user_info = vk.users.get(
            user_ids=user_id,
            fields="is_closed, can_access_closed"
        )[0]

        return user_info.get("is_closed", False)

    except Exception as e:
        print(f"❌ Ошибка при проверке закрытости аккаунта: {e}")
        return None


def send_vk_message(message: str) -> bool:
    """
    Отправляет сообщение в VK
    :param message: текст сообщения
    :return: True если успешно, False если ошибка
    """
    try:
        vk_session = vk_api.VkApi(token=VK_TOKEN)
        vk = vk_session.get_api()

        vk.messages.send(
            user_id=421965717,  
            message=message,
            random_id=0
        )
        print("✅ Сообщение отправлено в VK")
        return True
    except Exception as e:
        print(f"❌ Ошибка отправки сообщения в VK: {e}")
        return False


def get_registration_year(user_id, vk):
    """Получение года регистрации через первый пост на стене"""
    try:
        response = vk.wall.get(owner_id=user_id, count=1)

        if response["count"] == 0:
            return 2018  

        total_posts = response["count"]
        first_post_response = vk.wall.get(owner_id=user_id, count=1, offset=total_posts - 1)

        if not first_post_response["items"]:
            return 0

        first_post = first_post_response["items"][0]
        first_post_date = datetime.fromtimestamp(first_post["date"])
        return first_post_date.year

    except Exception:
        return 0


def get_user_info(vk, user_id):
    """Получение данных пользователя из VK API"""
    try:
        user_info = vk.users.get(
            user_ids=user_id,
            fields=(
                "photo_max, first_name, last_name, relation, personal, relatives, "
                "occupation, city, about, activities, books, games, movies, music, "
                "quotes, tv, universities, schools, city, counters"
            )
        )[0]

        user_data = {
            "user_id": user_id,
            "first_name": user_info.get("first_name", "Неизвестно"),
            "last_name": user_info.get("last_name", "Неизвестно"),
            "photo": user_info.get("photo_max", ""),
            "year": get_registration_year(user_id, vk),
            "followers_count": user_info.get("followers_count", 0),
            "has_personal": int("personal" in user_info),
            "has_relatives": int("relatives" in user_info),
            "has_occupation": int("occupation" in user_info),
            "join_year": int(user_info.get("bdate", "0").split(".")[-1]) if "bdate" in user_info else 0,
            "relation": user_info.get("relation", 0),
            "city": int(bool(user_info.get("city", {}).get("id", 0))),
            "friends_count": vk.friends.get(user_id=user_id, count=1)["count"],
            "photo_count": vk.photos.getAll(owner_id=user_id, count=1)["count"],
            "groups_count": vk.groups.get(user_id=user_id, extended=1)["count"],
            "about_length": len(user_info.get("about", "")),
            "activities_length": len(user_info.get("activities", "")),
            "books_length": len(user_info.get("books", "")),
            "games_length": len(user_info.get("games", "")),
            "movies_length": len(user_info.get("movies", "")),
            "music_length": len(user_info.get("music", "")),
            "quotes_length": len(user_info.get("quotes", "")),
            "tv_length": len(user_info.get("tv", "")),
            "has_universities": int(bool(user_info.get("universities"))),
            "has_schools": int(bool(user_info.get("schools"))),
        }

        counters = user_info.get("counters", {})

        for key in [
            "albums", "audios", "followers", "friends", "gifts",
            "pages", "photos", "subscriptions", "videos", "video_playlists",
            "clips_followers", "clips_views", "clips_likes"
        ]:
            user_data[key] = counters.get(key, 0)

        posts = vk.wall.get(owner_id=user_id, count=100)
        user_data["status_update_frequency"] = len(posts["items"])
        status_text = vk.status.get(user_id=user_id).get('text', '')
        user_data["has_numbers"] = 1 if re.search(r"\d", status_text) else 0
        user_data["status_length"] = len(status_text)
        user_data["hashtags_count"] = sum(post["text"].count("#") for post in posts["items"])

        return user_data
    except vk_api.exceptions.ApiError as e:
        print(f"Ошибка при получении данных: {e}")
        return None


def get_user_feature_importance(model_, df_user: pd.DataFrame):
    """Анализ важности признаков для конкретного пользователя"""
    base_proba = model_.predict_proba(df_user)[0][0]  # Вероятность "Fake"
    feature_scores = {}

    for feature in df_user.columns:
        temp_df = df_user.copy()
        temp_df[feature] = feature_values[feature]
        new_proba = model_.predict_proba(temp_df)[0][0]
        feature_scores[feature] = base_proba - new_proba

    top_features = sorted(feature_scores, key=feature_scores.get, reverse=True)[:3]
    return [(f, df_user.iloc[0][f]) for f in top_features]





def _load_attempts():
    """Читает файл с попытками и сбрасывает лимиты при смене дня."""
    today = date.today().isoformat()
    changed = False
    try:
        with open(ATTEMPTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {"last_reset": today, "users": {}}
        changed = True

    if data.get("last_reset") != today:
        data["last_reset"] = today
        data["users"] = {user_id: DAILY_ATTEMPTS for user_id in data.get("users", {})}
        changed = True

    if changed:
        _save_attempts(data)

    return data


def _save_attempts(data: dict) -> None:
    with open(ATTEMPTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_remaining_attempts(user_id: str) -> int:
    data = _load_attempts()
    user_key = str(user_id)
    remaining = int(data.get("users", {}).get(user_key, DAILY_ATTEMPTS))
    if user_key not in data.get("users", {}):
        data.setdefault("users", {})[user_key] = remaining
        _save_attempts(data)
    return remaining


def consume_attempt(user_id: str):
    """Списывает попытку; возвращает остаток и флаг, можно ли продолжать."""
    data = _load_attempts()
    user_key = str(user_id)
    remaining = int(data.get("users", {}).get(user_key, DAILY_ATTEMPTS))

    if remaining <= 0:
        return remaining, False

    data.setdefault("users", {})[user_key] = remaining - 1
    _save_attempts(data)
    return remaining - 1, True


def verify_vk_signature(vk_params: dict):
    """
    Проверяет HMAC-SHA256 подпись vk_ параметров mini-app.
    Возвращает (is_valid, vk_user_id | None, error_message | None)
    """
    if not VK_APP_SECRET:
        return False, None, "VK_APP_SECRET is not configured"

    if not isinstance(vk_params, dict):
        return False, None, "vk_params missing"

    sign = vk_params.get("sign")
    if not sign:
        return False, None, "sign missing"

    items = []
    for key, value in vk_params.items():
        if key.startswith("vk_"):
            items.append((key, str(value)))

    items.sort(key=lambda x: x[0])
    data_string = "&".join([f"{k}={v}" for k, v in items])

    digest = hmac.new(VK_APP_SECRET.encode("utf-8"), data_string.encode("utf-8"), "sha256").digest()
    expected = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")

    if expected != sign:
        return False, None, "Invalid sign"

    vk_user_id = vk_params.get("vk_user_id")
    return True, vk_user_id, None


def is_subscription_active(vk_params: dict) -> bool:
    """
    Проверяем на сервере подписку, используя подписанные vk_ параметры.
    Возвращает True, если подписка активна или только что оплачена.
    """
    try:
        resp = requests.post(
            SUBSCRIPTION_STATUS_URL,
            json={"vk_params": vk_params},
            timeout=5,
        )
        if resp.status_code != 200:
            return False
        data = resp.json()
        status = data.get("subscription", {}).get("status")
        if data.get("active"):
            return True
        return status in ("active", "chargeable")
    except Exception as exc:
        print(f"⚠️ Не удалось проверить подписку: {exc}")
        return False


def grant_bonus_attempt(user_id: str):
    """Добавляет одну попытку после просмотра рекламы, если лимит исчерпан."""
    data = _load_attempts()
    user_key = str(user_id)
    remaining = int(data.get("users", {}).get(user_key, DAILY_ATTEMPTS))

    granted = False
    if remaining <= 0:
        data.setdefault("users", {})[user_key] = 1
        _save_attempts(data)
        granted = True
        remaining = 1

    return remaining, granted

@app.get("/", response_class=HTMLResponse)
async def index():
    """Простая HTML-заглушка для проверки, что сервис работает"""
    html_content = """
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8" />
        <title>FakeCheck API</title>
        <style>
            body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: #0f172a;
                color: #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
            }
            .card {
                background: #020617;
                padding: 24px 28px;
                border-radius: 16px;
                box-shadow: 0 24px 60px rgba(15,23,42,0.8);
                border: 1px solid rgba(148,163,184,0.2);
                max-width: 420px;
                text-align: center;
            }
            h1 {
                margin: 0 0 12px;
                font-size: 24px;
            }
            p {
                margin: 0 0 4px;
                font-size: 14px;
                color: #9ca3af;
            }
            code {
                background: #020617;
                border-radius: 6px;
                padding: 4px 6px;
                font-size: 13px;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Привет, мир 👋</h1>
            <p>FakeCheck API запущен и работает.</p>
            <p>Для анализа профиля отправляй POST запрос на <code>/analyze</code>.</p>
            <p>Документация FastAPI: <code>/docs</code></p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.post("/analyze")
async def analyze_user(request: Request):
    """Анализ пользователя (полная логика сохранена)"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        vk_params = data.get("vk_params") or {}
        is_valid, requester_id, sign_error = verify_vk_signature(vk_params)
        if not user_id:
            return JSONResponse({"error": "Не передан user_id"}, status_code=400)
        if not is_valid or not requester_id:
            return JSONResponse(
                {"error": f"Неверная подпись: {sign_error or 'unknown'}"},
                status_code=403,
            )

        subscribed = is_subscription_active(vk_params)
        if subscribed:
            remaining_after, allowed, daily_limit_value = UNLIMITED_ATTEMPTS, True, UNLIMITED_ATTEMPTS
        else:
            remaining_after, allowed = consume_attempt(str(requester_id))
            daily_limit_value = DAILY_ATTEMPTS

        if not allowed:
            return JSONResponse(
                {
                    "error": "Дневной лимит попыток исчерпан",
                    "remaining_attempts": max(remaining_after, 0),
                    "daily_limit": daily_limit_value,
                },
                status_code=429,
            )

        print(f"🔍 Получен запрос на анализ пользователя: {user_id}")

        start_message = (
            f"🔍 Начат анализ пользователя ID: {user_id}\n"
            f"Время: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}"
        )
        send_vk_message(start_message)

        vk_session = vk_api.VkApi(token=VK_TOKEN)
        vk = vk_session.get_api()

        try:
            user_brief_response = vk.users.get(
                user_ids=user_id,
                fields="photo_max, first_name, last_name, verified"
            )
            if not user_brief_response:
                return JSONResponse({"error": "Пользователь не найден"}, status_code=404)
            user_brief = user_brief_response[0]
        except (vk_api.exceptions.ApiError, IndexError) as e:
            print(f"Ошибка поиска пользователя: {e}")
            return JSONResponse({"error": "Пользователь не найден"}, status_code=404)

        
        is_closed = is_account_closed(user_id, VK_TOKEN)
        if is_closed is None:
            print("⚠️ Не удалось проверить закрытость аккаунта, продолжаем анализ")
        elif is_closed:
            closed_message = (
                f"🔒 Обнаружен закрытый аккаунт\n"
                f"ID: {user_id}\n"
                f"Имя: {user_brief.get('first_name', 'Неизвестно')} "
                f"{user_brief.get('last_name', 'Неизвестно')}\n"
                f"Время: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}"
            )
            send_vk_message(closed_message)

            return {
                "user_id": user_id,
                "first_name": user_brief.get("first_name", "Неизвестно"),
                "last_name": user_brief.get("last_name", "Неизвестно"),
                "photo": user_brief.get("photo_max", ""),
                "result": "🔒 Закрытый аккаунт",
                "message": "Этот профиль закрыт для просмотра. Мы не можем проанализировать закрытые аккаунты.",
                "is_closed": True,
                "remaining_attempts": remaining_after,
                "daily_limit": daily_limit_value,
            }

        if user_brief.get("verified", 0) == 1:
            verified_message = (
                f"✅ Обнаружен верифицированный аккаунт\n"
                f"ID: {user_id}\n"
                f"Имя: {user_brief.get('first_name', 'Неизвестно')} "
                f"{user_brief.get('last_name', 'Неизвестно')}\n"
                f"Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"
            )
            send_vk_message(verified_message)

            return {
                "user_id": user_id,
                "first_name": user_brief.get("first_name", "Неизвестно"),
                "last_name": user_brief.get("last_name", "Неизвестно"),
                "photo": user_brief.get("photo_max", ""),
                "result": "✅ Подтверждён",
                "message": "Пользователь подтверждён модераторами VK и заслуживает доверия.",
                "verified": True,
                "remaining_attempts": remaining_after,
                "daily_limit": daily_limit_value,
            }

        user_data = get_user_info(vk, user_id)
        if not user_data:
            return JSONResponse({"error": "Не удалось получить данные пользователя"}, status_code=500)

        df_user = pd.DataFrame([user_data])
        df_user = df_user[model.feature_names_in_]

        prediction = model.predict(df_user)[0]
        probabilities = model.predict_proba(df_user)[0]

        suspicious_criteria = get_user_feature_importance(model, df_user)

        result = "Real" if prediction == 1 else "Fake"
        fake_prob = round(probabilities[0] * 100, 2)
        real_prob = round(probabilities[1] * 100, 2)

        response = {
            "user_id": user_id,
            "first_name": user_data["first_name"],
            "last_name": user_data["last_name"],
            "photo": user_data["photo"],
            "result": result,
            "fake_prob": fake_prob,
            "real_prob": real_prob,
            "suspicious_criteria": [
                f"{feature_translation.get(feature, feature)}: {value}"
                for feature, value in suspicious_criteria
            ],
            "remaining_attempts": remaining_after,
            "daily_limit": daily_limit_value,
        }

        print(f"📊 Анализ завершён: {response}")

        analysis_message = (
            f"📊 Анализ завершён\n"
            f"ID: {user_id}\n"
            f"Имя: {user_data['first_name']} {user_data['last_name']}\n"
            f"Результат: {result}\n"
            f"Вероятность фейка: {fake_prob}%\n"
            f"Вероятность реального: {real_prob}%\n"
            f"Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"
        )
        send_vk_message(analysis_message)

        return response

    except Exception as e:
        print(f"Ошибка: {e}")
        error_message = (
            f"❌ Ошибка при анализе\n"
            f"ID: {user_id if 'user_id' in locals() else 'Неизвестно'}\n"
            f"Ошибка: {str(e)}\n"
            f"Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"
        )
        send_vk_message(error_message)
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/save-additional-answer")
async def save_additional_answer(request: Request):
    """Сохраняет один ответ на дополнительную проверку"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        check_id = data.get("check_id")
        answer = data.get("answer") 

        if not all([user_id, check_id, answer]):
            return JSONResponse({"error": "Не все данные переданы"}, status_code=400)

        answers_file = f"additional_answers_{user_id}.json"
        try:
            with open(answers_file, 'r', encoding='utf-8') as f:
                answers = json.load(f)
        except FileNotFoundError:
            answers = {}

        answers[check_id] = answer

        with open(answers_file, 'w', encoding='utf-8') as f:
            json.dump(answers, f, ensure_ascii=False, indent=2)

        print(f"✅ Ответ сохранён: ID {check_id} = {answer}")
        return {"status": "success", "message": "Ответ сохранён"}

    except Exception as e:
        print(f"❌ Ошибка сохранения ответа: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/finish-additional-checks")
async def finish_additional_checks(request: Request):
    """Завершает дополнительные проверки и отправляет сообщение в VK"""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if not user_id:
            return JSONResponse({"error": "Не передан user_id"}, status_code=400)

        answers_file = f"additional_answers_{user_id}.json"
        try:
            with open(answers_file, 'r', encoding='utf-8') as f:
                answers = json.load(f)
        except FileNotFoundError:
            return JSONResponse({"error": "Ответы не найдены"}, status_code=404)

        answers_text = ""
        for check_id, answer in answers.items():
            answer_text = 'Фейк' if answer == 'fake' else 'Реальный' if answer == 'real' else 'Закрытый'
            answers_text += f"ID {check_id}: {answer_text}\n"

        message = f"""🔍 Дополнительные проверки FakeCheck

Пользователь проверил {len(answers)} случайных аккаунтов:

{answers_text}
Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"""

        send_vk_message(message)

        try:
            import os
            os.remove(answers_file)
        except Exception:
            pass

        print(f"✅ Дополнительные проверки завершены для пользователя {user_id}")
        return {"status": "success", "message": "Проверки завершены"}

    except Exception as e:
        print(f"❌ Ошибка завершения проверок: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/save-feedback")
async def save_feedback(request: Request):
    """Сохраняет обратную связь пользователя"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        is_correct = data.get("is_correct")

        if user_id is None or is_correct is None:
            return JSONResponse({"error": "Не все данные переданы"}, status_code=400)

        feedback_text = "✅ Верно" if is_correct else "❌ Неверно"
        message = f"""🤔 Обратная связь FakeCheck

Пользователь оценил результат анализа:
ID: {user_id}
Оценка: {feedback_text}
Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"""

        send_vk_message(message)

        print(f"✅ Обратная связь сохранена: ID {user_id} = {feedback_text}")
        return {"status": "success", "message": "Обратная связь сохранена"}

    except Exception as e:
        print(f"❌ Ошибка сохранения обратной связи: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/submit-survey")
async def submit_survey(request: Request):
    """Обрабатывает опрос пользователя по улучшению модели"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        accuracy = data.get("accuracy")
        features = data.get("features", [])
        suggestions = data.get("suggestions", "")
        help_with_labeling = data.get("helpWithLabeling", False)

        if user_id is None or accuracy is None:
            return JSONResponse({"error": "Не все обязательные данные переданы"}, status_code=400)

        accuracy_translation = {
            'very_accurate': 'Очень точный',
            'accurate': 'Точный',
            'average': 'Средний',
            'inaccurate': 'Неточный',
            'very_inaccurate': 'Очень неточный'
        }

        features_translation = {
            'batch_check': 'Массовая проверка друзей',
            'history_export': 'Экспорт истории проверок',
            'notifications': 'Уведомления о новых фейках',
            'advanced_stats': 'Расширенная статистика',
            'api_access': 'API для разработчиков'
        }

        features_text = ", ".join(
            [features_translation.get(f, f) for f in features]
        ) if features else "Не выбрано"
        help_text = "✅ Да, хочу помочь!" if help_with_labeling else "🤔 Возможно, позже"

        message = f"""📊 Опрос улучшения модели FakeCheck

Пользователь заполнил опрос:
ID: {user_id}
Точность анализа: {accuracy_translation.get(accuracy, accuracy)}
Желаемые функции: {features_text}
Предложения: {suggestions if suggestions else "Не указано"}
Помощь с разметкой: {help_text}
Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"""

        send_vk_message(message)

        print(f"✅ Опрос сохранен: ID {user_id}")
        return {"status": "success", "message": "Опрос сохранен"}

    except Exception as e:
        print(f"❌ Ошибка сохранения опроса: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/save-survey-labeling-answer")
async def save_survey_labeling_answer(request: Request):
    """Сохраняет ответ пользователя на разметку данных из опроса"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        check_id = data.get("check_id")
        answer = data.get("answer")

        if user_id is None or check_id is None or answer is None:
            return JSONResponse({"error": "Не все данные переданы"}, status_code=400)

        answers_file = f"survey_labeling_answers_{user_id}.json"
        try:
            with open(answers_file, 'r', encoding='utf-8') as f:
                answers = json.load(f)
        except FileNotFoundError:
            answers = {}

        answers[check_id] = answer

        with open(answers_file, 'w', encoding='utf-8') as f:
            json.dump(answers, f, ensure_ascii=False, indent=2)

        print(f"✅ Ответ разметки сохранён: ID {check_id} = {answer}")
        return {"status": "success", "message": "Ответ сохранён"}

    except Exception as e:
        print(f"❌ Ошибка сохранения ответа разметки: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/finish-survey-labeling")
async def finish_survey_labeling(request: Request):
    """Завершает разметку данных из опроса и отправляет сообщение в VK"""
    try:
        data = await request.json()
        user_id = data.get("user_id")

        if not user_id:
            return JSONResponse({"error": "Не передан user_id"}, status_code=400)

        answers_file = f"survey_labeling_answers_{user_id}.json"
        try:
            with open(answers_file, 'r', encoding='utf-8') as f:
                answers = json.load(f)
        except FileNotFoundError:
            return JSONResponse({"error": "Ответы не найдены"}, status_code=404)

        answers_text = ""
        for check_id, answer in answers.items():
            answer_text = 'Фейк' if answer == 'fake' else 'Реальный' if answer == 'real' else 'Закрытый'
            answers_text += f"ID {check_id}: {answer_text}\n"

        message = f"""🧠 Разметка данных из опроса FakeCheck

Пользователь помог с разметкой данных:
ID пользователя: {user_id}
Проверено профилей: {len(answers)}

{answers_text}
Время: {datetime.now().strftime('%d.%м.%Y %H:%M:%S')}"""

        send_vk_message(message)

        try:
            import os
            os.remove(answers_file)
        except Exception:
            pass

        print(f"✅ Разметка данных завершена для пользователя {user_id}")
        return {"status": "success", "message": "Разметка завершена"}

    except Exception as e:
        print(f"❌ Ошибка завершения разметки: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/attempts")
async def attempts(request: Request):
    """Возвращает остаток попыток для пользователя (по vk_params)."""
    try:
        data = await request.json()
        vk_params = data.get("vk_params") or {}
        is_valid, vk_user_id, sign_error = verify_vk_signature(vk_params)
        if not is_valid or not vk_user_id:
            return JSONResponse(
                {"error": f"Неверная подпись: {sign_error or 'unknown'}"},
                status_code=403,
            )

        if is_subscription_active(vk_params):
            remaining = UNLIMITED_ATTEMPTS
            daily_limit_value = UNLIMITED_ATTEMPTS
        else:
            remaining = get_remaining_attempts(str(vk_user_id))
            daily_limit_value = DAILY_ATTEMPTS
        attempt_data = _load_attempts()
        return {
            "user_id": vk_user_id,
            "remaining_attempts": remaining,
            "daily_limit": daily_limit_value,
            "last_reset": attempt_data.get("last_reset"),
        }
    except Exception as e:
        print(f"❌ Ошибка получения попыток: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/bonus-attempt")
async def bonus_attempt(request: Request):
    """Добавляет одну попытку после просмотра рекламы, если лимит нулевой."""
    try:
        data = await request.json()
        vk_params = data.get("vk_params") or {}
        is_valid, vk_user_id, sign_error = verify_vk_signature(vk_params)
        if not is_valid or not vk_user_id:
            return JSONResponse(
                {"error": f"Неверная подпись: {sign_error or 'unknown'}"},
                status_code=403,
            )

        if is_subscription_active(vk_params):
            remaining, granted, daily_limit_value = UNLIMITED_ATTEMPTS, False, UNLIMITED_ATTEMPTS
        else:
            remaining, granted = grant_bonus_attempt(str(vk_user_id))
            daily_limit_value = DAILY_ATTEMPTS
        attempt_data = _load_attempts()
        return {
            "user_id": vk_user_id,
            "remaining_attempts": remaining,
            "daily_limit": daily_limit_value,
            "last_reset": attempt_data.get("last_reset"),
            "granted": granted,
        }
    except Exception as e:
        print(f"❌ Ошибка добавления бонусной попытки: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

# На render.com обычно запускают так:
# uvicorn app:app --host 0.0.0.0 --port 10000
