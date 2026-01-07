import base64
import hashlib
import hmac
import json
import os
import time
import urllib.parse
from pathlib import Path

from flask import Flask, jsonify, request


app = Flask(__name__)


def _add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    return response


@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        return _add_cors_headers(app.make_response(('OK', 200)))


@app.after_request
def apply_cors(response):
    return _add_cors_headers(response)


# Replace with your real access key from VK Pay/Subscriptions settings
ACCESS_KEY = os.getenv('VK_PAY_ACCESS_KEY', 'Yw1u8Pcq52yXOdagDGOa').strip()
# Secret from mini-app settings is used to validate vk_ launch params coming from the client
VK_APP_SECRET = os.getenv('VK_APP_SECRET', ACCESS_KEY).strip()
BASE_DIR = Path(__file__).resolve().parent
SUBSCRIPTIONS_FILE = BASE_DIR / 'subscriptions.json'


WINTER_THEME = {
    'title': 'Снежная подписка',
    'accent': '#7dd0ff',
    'bg': '#0b1b2b',
    'emoji': '❄️',
    'badge': 'НОВОГОДНИЙ ПАС',
    'message': 'Подписка дарит зимние бонусы и тёплый огоньок в FakeCheck.'
}


# Minimal in-memory catalog
sale_items = {
    'sale_item_subscription_1': {
        'title': '❄️ Снежная подписка • 30 дней',
        'price': 5,
        'photo_url': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80',
        "period": 30,  # days
        "trial_duration": 3,  # days of gift snow
        "expiration": 3600,
        "winter_theme": WINTER_THEME
    },
}

ALLOWED_SUBSCRIPTION_STATUSES = {'chargeable', 'active', 'cancelled'}


def ensure_user_memory(store: dict, user_id: str):
    if not user_id:
        return store
    users = store.setdefault('users', {})
    key = str(user_id)
    users.setdefault(key, {
        'user_id': key,
        'activated': 0,
        'cancelled': 0,
        'last_status': None,
        'last_subscription_id': None,
        'subscriptions': {},
        'last_event_at': int(time.time()),
        'manual_touch': 0,
    })
    return store


def update_user_memory(store: dict, user_id: str, subscription_id: str, status: str, manual_touch: bool = False):
    if not user_id:
        return store
    store = ensure_user_memory(store, user_id)
    users = store.get('users', {})
    key = str(user_id)
    memory = users.get(key, {})
    subscriptions = memory.get('subscriptions', {})
    subscription_key = subscription_id or 'unknown'
    prev_status = subscriptions.get(subscription_key)
    subscriptions[subscription_key] = status

    # Count first activation per subscription
    if subscription_id and prev_status is None and status in ('chargeable', 'active'):
        memory['activated'] = memory.get('activated', 0) + 1
    if status == 'cancelled':
        memory['cancelled'] = memory.get('cancelled', 0) + 1

    memory['subscriptions'] = subscriptions
    memory['last_status'] = status
    memory['last_subscription_id'] = subscription_key
    memory['last_event_at'] = int(time.time())
    if manual_touch:
        memory['manual_touch'] = memory.get('manual_touch', 0) + 1
        if memory.get('activated', 0) == 0:
            # Если вручную отметили, считаем, что одна активация была
            memory['activated'] = 1
    users[key] = memory
    store['users'] = users
    return store


def extract_user_memory(store: dict, user_id: str) -> dict:
    store = ensure_user_memory(store, user_id)
    users = store.get('users', {})
    key = str(user_id)
    memory = users.get(key, {})
    # Fail-safe: если память пустая, попробуем посчитать из subscriptions
    if memory.get('activated') == 0 and memory.get('subscriptions') == {}:
        activated = 0
        cancelled = 0
        last_status = None
        last_subscription_id = None
        last_event_at = 0
        for sid, entry in store.get('subscriptions', {}).items():
            if str(entry.get('user_id')) != key:
                continue
            status = entry.get('status')
            last_status = status
            last_subscription_id = sid
            last_event_at = max(last_event_at, entry.get('last_event_at', 0))
            if status in ('chargeable', 'active'):
                activated += 1
            if status == 'cancelled':
                cancelled += 1
        memory.update({
            'activated': activated,
            'cancelled': cancelled,
            'last_status': last_status,
            'last_subscription_id': last_subscription_id,
            'last_event_at': last_event_at,
        })
        users[key] = memory
        store['users'] = users
    memory['require_votes'] = memory.get('activated', 0) > 0
    return memory


def load_subscription_store() -> dict:
    if not SUBSCRIPTIONS_FILE.exists():
        return {'subscriptions': {}, 'users': {}, 'updated_at': int(time.time())}
    try:
        with open(SUBSCRIPTIONS_FILE, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                data.setdefault('subscriptions', {})
                data.setdefault('users', {})
                data.setdefault('updated_at', int(time.time()))
                return data
    except Exception as exc:
        print(f"Failed to read subscription store: {exc}")
    return {'subscriptions': {}, 'users': {}, 'updated_at': int(time.time())}


def save_subscription_store(data: dict):
    temp_file = SUBSCRIPTIONS_FILE.with_suffix('.tmp')
    try:
        with open(temp_file, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        temp_file.replace(SUBSCRIPTIONS_FILE)
    except Exception as exc:
        print(f"Failed to persist subscription store: {exc}")
        return


def get_cached_response(subscription_id: str, status: str):
    store = load_subscription_store()
    entry = store.get('subscriptions', {}).get(subscription_id)
    if not entry:
        return None
    if entry.get('status') == status and entry.get('last_response'):
        return entry['last_response']
    return None


def remember_subscription_event(subscription_id: str, params: dict, status: str, response: dict, item_code: str):
    store = load_subscription_store()
    subs = store.get('subscriptions', {})
    entry = subs.get(subscription_id, {})
    entry.update({
        'subscription_id': subscription_id,
        'user_id': params.get('user_id'),
        'item': item_code,
        'status': status,
        'next_bill_time': params.get('next_bill_time'),
        'cancel_reason': params.get('cancel_reason'),
        'last_event_at': int(time.time()),
        'last_response': response,
        'winter_message': WINTER_THEME.get('message'),
    })
    subs[subscription_id] = entry
    store['subscriptions'] = subs
    store = update_user_memory(store, params.get('user_id'), subscription_id, status)
    store['updated_at'] = int(time.time())
    save_subscription_store(store)


def build_winter_payload(status: str) -> dict:
    status_map = {
        'chargeable': 'Снежная оплата прошла — добро пожаловать в тёплый круг!',
        'active': 'Подписка активна, огоньки горят и бонусы доступны.',
        'cancelled': 'Подписка погасла, но мы оставим гирлянды наготове.',
    }
    return {
        'theme': WINTER_THEME,
        'status_text': status_map.get(status, 'Подписка обновлена.'),
        'snowflake': '❄️',
        'updated_at': int(time.time()),
    }


def php_url_decode(value: str) -> str:
    if value is None:
        return ''
    # Decodes PHP-style urlencoded strings, including '+' as space
    return urllib.parse.unquote_plus(value)


def calc_signature(params: dict) -> str:
    # Sort keys and concatenate as key=value without separators, excluding 'sig'
    parts = []
    for key in sorted(params.keys()):
        if key == 'sig':
            continue
        parts.append(f"{key}={params[key]}")
    base = ''.join(parts) + ACCESS_KEY
    return hashlib.md5(base.encode('utf-8')).hexdigest()


def verify_launch_params(vk_params: dict) -> bool:
    """
    Validates VK Mini Apps launch params signature to protect the status endpoint
    from forged user_id values.
    """
    if not vk_params:
        return False
    sign = vk_params.get('sign')
    if not sign:
        return False
    vk_subset = {k: v for k, v in vk_params.items() if k.startswith('vk_')}
    if not vk_subset:
        return False
    ordered = sorted(vk_subset.items())
    query = '&'.join([f"{k}={v}" for k, v in ordered])
    digest = hmac.new(VK_APP_SECRET.encode('utf-8'), msg=query.encode('utf-8'), digestmod=hashlib.sha256).digest()
    expected_sign = base64.urlsafe_b64encode(digest).decode('utf-8').rstrip('=')
    return hmac.compare_digest(expected_sign, sign)


def extract_vk_params_from_request():
    """
    Pull vk_ params (and sign) from JSON body or query string.
    Returns tuple of (vk_params, raw_payload_dict).
    """
    payload = request.get_json(silent=True) or {}
    vk_params = {}
    if isinstance(payload.get('vk_params'), dict):
        vk_params.update(payload['vk_params'])
    for key, value in request.args.items():
        if key.startswith('vk_') or key == 'sign':
            vk_params.setdefault(key, value)
    if 'sign' in payload:
        vk_params.setdefault('sign', payload.get('sign'))
    return vk_params, payload


def normalize_notification_type(notification_type: str) -> str:
    if not notification_type:
        return ''
    # Map *_test to base type while keeping original available if needed
    if notification_type.endswith('_test'):
        return notification_type[:-5]
    return notification_type


def handle_get_item(params: dict):
    item_code = params.get('item')
    item = sale_items.get(item_code)
    if item:
        # Добавляем item_id для совместимости с фронтендом
        response_item = item.copy()
        response_item['item_id'] = item_code
        return {'response': response_item}
    return {
        'error': {
            'error_code': 20,
            'error_msg': 'Товара не существует',
            'critical': True,
        }
    }


def handle_get_subscription(params: dict):
    print(f"handle_get_subscription called with params: {params}")
    item_code = params.get('item')
    item = sale_items.get(item_code)
    if item:
        # Добавляем item_id для совместимости с фронтендом
        response_item = item.copy()
        response_item['item_id'] = item_code
        response_item['winter'] = build_winter_payload('active')

        # Показываем последний статус подписки пользователя, если он есть
        user_id = params.get('user_id')
        if user_id:
            store = load_subscription_store()
            active_subscription = None
            for entry in store.get('subscriptions', {}).values():
                if str(entry.get('user_id')) == str(user_id) and entry.get('status') in ('chargeable', 'active'):
                    active_subscription = {
                        'subscription_id': entry.get('subscription_id'),
                        'status': entry.get('status'),
                        'next_bill_time': entry.get('next_bill_time'),
                        'winter_message': entry.get('winter_message'),
                    }
                    break
            response_item['active_subscription'] = active_subscription
        print(f"Returning response: {response_item}")
        return {'response': response_item}
    return {
        'error': {
            'error_code': 20,
            'error_msg': 'Подписки не существует в нашем снежном каталоге',
            'critical': True,
        }
    }


def handle_order_status_change(params: dict):
    status = params.get('status')
    if status == 'chargeable':
        # Grant item/subscription here and persist order
        app_order_id = 1  # Your internal order id
        return {
            'response': {
                'order_id': params.get('order_id'),
                'app_order_id': app_order_id,
            }
        }
    if status == 'refund':
        # Handle refund (revoke subscription, etc.)
        return {'response': {'ok': True}}
    return {
        'error': {
            'error_code': 11,
            'error_msg': 'Ошибка в структуре данных',
            'critical': True,
        }
    }


def handle_subscription_status_change(params: dict):
    subscription_id = str(params.get('subscription_id') or '').strip()
    status = params.get('status')
    item_code = params.get('item') or params.get('item_id')

    if not subscription_id or not status:
        return {
            'error': {
                'error_code': 11,
                'error_msg': 'Нет subscription_id или status',
                'critical': True,
            }
        }

    # Fallback: look up stored item by subscription_id if not provided in notification
    if not item_code:
        store = load_subscription_store()
        entry = store.get('subscriptions', {}).get(subscription_id)
        if entry:
            item_code = entry.get('item')

    if not item_code or item_code not in sale_items:
        return {
            'error': {
                'error_code': 20,
                'error_msg': 'Неизвестная снежная подписка',
                'critical': True,
            }
        }

    if status not in ALLOWED_SUBSCRIPTION_STATUSES:
        return {
            'error': {
                'error_code': 11,
                'error_msg': f'Неожиданный статус подписки: {status}',
                'critical': True,
            }
        }

    cached = get_cached_response(subscription_id, status)
    if cached:
        print(f"Replay cached response for subscription {subscription_id} with status {status}")
        return cached

    winter_payload = build_winter_payload(status)
    base_response = {
        'subscription_id': subscription_id,
        'status': status,
        'user_id': params.get('user_id'),
        'item': item_code,
        'next_bill_time': params.get('next_bill_time'),
        'winter': winter_payload,
    }

    if status == 'chargeable':
        base_response['app_order_id'] = f"snow-{subscription_id}"
        base_response['grant'] = 'subscription_enabled'
    # Attach catalog data so frontend can instantly render without extra calls
    catalog_item = sale_items.get(item_code)
    if catalog_item:
        base_response['photo_url'] = catalog_item.get('photo_url')
        base_response['title'] = catalog_item.get('title')
    elif status == 'active':
        base_response['active'] = True
    elif status == 'cancelled':
        base_response['active'] = False
        base_response['cancel_reason'] = params.get('cancel_reason')
    else:
        return {
            'error': {
                'error_code': 11,
                'error_msg': f'Неожиданный статус подписки: {status}',
                'critical': True,
            }
        }

    response = {'response': base_response}
    remember_subscription_event(subscription_id, params, status, response, item_code)
    return response

@app.get('/')
def index():
    return """
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>Привет от Деда Мороза! ❄️</title>
        <style>
            body {
                background: linear-gradient(to bottom, #0b1b2b, #1c3a5f);
                color: #7dd0ff;
                font-family: 'Segoe UI', sans-serif;
                text-align: center;
                padding: 50px 20px;
                margin: 0;
            }
            h1 {
                font-size: 2.5em;
                margin-bottom: 20px;
                text-shadow: 0 0 10px rgba(125, 208, 255, 0.7);
            }
            .snowflake {
                font-size: 3em;
                animation: fall 5s infinite linear;
                display: block;
                margin: 20px auto;
            }
            @keyframes fall {
                0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
            }
        </style>
    </head>
    <body>
        <h1>Привет, дед Мороз! 🎅</h1>
        <p>Добро пожаловать в зимнюю мастерскую FakeCheck!</p>
        <div class="snowflake">❄️</div>
        <p>Здесь живут снежные подписки и тёплые огоньки кода.</p>
    </body>
    </html>
    """

@app.post('/purchase')
def purchase():
    # Raw body may be in application/x-www-form-urlencoded format
    raw = request.get_data(as_text=True) or ''

    # Build params dict similar to Node example
    params = {}
    if raw:
        for pair in raw.split('&'):
            if not pair:
                continue
            if '=' in pair:
                k, v = pair.split('=', 1)
            else:
                k, v = pair, ''
            params[k] = php_url_decode(v)

    # Fallback: also merge parsed form (in case framework parsed it)
    for k, v in request.form.items():
        params.setdefault(k, v)

    safe_log = {
        'notification_type': params.get('notification_type'),
        'status': params.get('status'),
        'item': params.get('item'),
        'user_id': params.get('user_id'),
    }
    print(f"Incoming notification: {safe_log}")

    # Verify signature
    provided_sig = params.get('sig', '')
    calculated_sig = calc_signature(params)
    print(f"Signature check: provided={provided_sig}, calculated={calculated_sig}")
    if calculated_sig != provided_sig:
        print("SIGNATURE MISMATCH!")
        return jsonify({
            'error': {
                'error_code': 20,
                'error_msg': 'Несовпадение переданной и вычисленной подписи',
                'critical': True,
            }
        })
    print("Signature OK!")

    # Normalize notification type to support test mode
    raw_type = params.get('notification_type', '')
    base_type = normalize_notification_type(raw_type)

    # Handle different notification types
    print(f"Processing notification type: {raw_type} -> {base_type}")
    if base_type == 'get_item':
        resp = handle_get_item(params)
    elif base_type == 'get_subscription':
        resp = handle_get_subscription(params)
    elif base_type == 'subscription_status_change':
        resp = handle_subscription_status_change(params)
    elif base_type == 'order_status_change':
        resp = handle_order_status_change(params)
    else:
        resp = {
            'error': {
                'error_code': 11,
                'error_msg': f'Неизвестный тип уведомления: {raw_type}',
                'critical': True,
            }
        }

    print(f"Response: {resp}")

    return jsonify(resp)


# Use POST to avoid leaking sign in logs, but GET with vk_ params in query works too.
@app.route('/subscription/status', methods=['GET', 'POST'])
def subscription_status():
    """
    Простая точка для фронтенда: проверяет активную подписку пользователя или конкретный subscription_id.
    Требует подписи vk_ параметров, чтобы нельзя было подменить user_id. Возвращает снежный баннер.
    """
    vk_params, payload = extract_vk_params_from_request()
    subscription_id = payload.get('subscription_id') or request.args.get('subscription_id')
    user_id = payload.get('user_id') or request.args.get('user_id') or vk_params.get('vk_user_id')

    if not verify_launch_params(vk_params):
        return jsonify({
            'error': 'invalid sign',
            'winter': build_winter_payload('cancelled')
        }), 403

    store = load_subscription_store()
    subs = store.get('subscriptions', {})
    memory = extract_user_memory(store, user_id) if user_id else {}

    if subscription_id:
        entry = subs.get(subscription_id)
        if not entry:
            return jsonify({'error': 'subscription_id not found', 'winter': build_winter_payload('cancelled')}), 404
        if user_id and str(entry.get('user_id')) != str(user_id):
            return jsonify({'error': 'subscription_id does not belong to user', 'winter': build_winter_payload('cancelled')}), 403
        catalog_item = sale_items.get(entry.get('item'), {})
        enriched = dict(entry)
        enriched['photo_url'] = catalog_item.get('photo_url')
        enriched['title'] = catalog_item.get('title')
        return jsonify({
            'subscription': enriched,
            'winter': build_winter_payload(entry.get('status', 'active')),
            'memory': memory
        })

    if not user_id:
        return jsonify({'error': 'user_id or subscription_id required', 'winter': build_winter_payload('cancelled')}), 400

    filtered = [
        entry for entry in subs.values()
        if str(entry.get('user_id')) == str(user_id)
    ]

    if not filtered:
        return jsonify({
            'active': False,
            'winter': build_winter_payload('cancelled'),
            'message': 'Подписка не найдена, но снежинки всё равно летят.',
            'memory': memory
        })

    # Берем самую свежую запись
    latest = sorted(filtered, key=lambda x: x.get('last_event_at', 0), reverse=True)[0]
    is_active = latest.get('status') in ('chargeable', 'active')
    winter = build_winter_payload(latest.get('status', 'active'))
    catalog_item = sale_items.get(latest.get('item'), {})
    enriched_latest = dict(latest)
    enriched_latest['photo_url'] = catalog_item.get('photo_url')
    enriched_latest['title'] = catalog_item.get('title')

    return jsonify({
        'active': is_active,
        'subscription': enriched_latest,
        'winter': winter,
        'memory': memory
    })


@app.route('/subscription/memory', methods=['GET', 'POST'])
def subscription_memory():
    """
    Запоминаем, что пользователь оформлял подписку, и возвращаем его историю.
    action=touch — вручную отметить активацию, чтобы не давать повторный бесплатный период.
    """
    vk_params, payload = extract_vk_params_from_request()
    user_id = payload.get('user_id') or request.args.get('user_id') or vk_params.get('vk_user_id')
    action = payload.get('action') or request.args.get('action') or 'get'
    subscription_id = payload.get('subscription_id') or request.args.get('subscription_id')
    status = payload.get('status') or request.args.get('status') or 'touched'

    if not verify_launch_params(vk_params):
        return jsonify({'error': 'invalid sign'}), 403

    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    store = load_subscription_store()
    if action == 'touch':
        store = update_user_memory(store, user_id, subscription_id or 'manual', status, manual_touch=True)
        store['updated_at'] = int(time.time())
        save_subscription_store(store)

    memory = extract_user_memory(store, user_id)
    response = {
        'user_id': str(user_id),
        'require_votes': memory.get('require_votes', False),
        'activated': memory.get('activated', 0),
        'cancelled': memory.get('cancelled', 0),
        'last_status': memory.get('last_status'),
        'last_subscription_id': memory.get('last_subscription_id'),
        'last_event_at': memory.get('last_event_at'),
        'winter': build_winter_payload(memory.get('last_status') or 'cancelled')
    }
    return jsonify(response)


if __name__ == '__main__':
    # For local testing only
    app.run(host='0.0.0.0', port=8080, debug=True)
