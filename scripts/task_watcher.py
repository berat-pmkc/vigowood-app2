"""
VigoWood Ops Center — Agent Chat Watcher
Cevapsız kullanıcı mesajlarını algılayıp Claude API ile yanıt üretir.

Gereksinimler:
  pip install supabase anthropic

Ortam değişkenleri:
  SUPABASE_URL          — Supabase proje URL'i
  SUPABASE_SERVICE_ROLE_KEY — Service role key (RLS bypass)
  ANTHROPIC_API_KEY     — Claude API key

Çalıştırma:
  python scripts/task_watcher.py
"""

import os
import sys
import time
import json
import traceback

try:
    from supabase import create_client
except ImportError:
    print("HATA: 'supabase' paketi bulunamadı. Kurulum: pip install supabase")
    sys.exit(1)

try:
    from anthropic import Anthropic
except ImportError:
    print("HATA: 'anthropic' paketi bulunamadı. Kurulum: pip install anthropic")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

POLL_INTERVAL = 5  # saniye
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048
HISTORY_LIMIT = 10

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.")
    sys.exit(1)

if not ANTHROPIC_API_KEY:
    print("HATA: ANTHROPIC_API_KEY ortam değişkeni gerekli.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
anthropic = Anthropic(api_key=ANTHROPIC_API_KEY)


# ─── Chat Handler ─────────────────────────────────────────────

def handle_chat_reply(agent: dict, user_msg: dict):
    """Bir agent için cevapsız mesaja Claude ile yanıt üretir."""
    agent_id = agent["id"]
    agent_name = agent["name"]
    print(f"  → {agent_name}: Cevapsız mesaj bulundu, yanıt üretiliyor...")

    # Son N mesajı al (conversation history)
    history_resp = (
        supabase.table("agent_chats")
        .select("role,content")
        .eq("agent_id", agent_id)
        .order("created_at", desc=False)
        .limit(HISTORY_LIMIT)
        .execute()
    )
    history = history_resp.data or []
    messages = [{"role": m["role"], "content": m["content"]} for m in history]

    system_prompt = f"""Sen VigoWood iş asistanısın. Adın: {agent_name}.
Departman: {agent.get('department', '')}.
Açıklama: {agent.get('description', '')}.
Yetenekler: {json.dumps(agent.get('capabilities', []), ensure_ascii=False)}.

VigoWood ahşap mobilya üretim firmasıdır. MES, stok, satış, sevkiyat ve muhasebe modülleri olan bir ERP platformu kullanılmaktadır.

Kullanıcının sorularına Türkçe, markdown formatında, somut ve kısa cevap ver. Bilmediğin konularda spekülasyon yapma, bilmediğini belirt."""

    try:
        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=messages,
        )

        reply = response.content[0].text
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        total_tokens = input_tokens + output_tokens
        cost_estimate = (input_tokens * 0.003 + output_tokens * 0.015) / 1000

        # Yanıtı DB'ye yaz
        supabase.table("agent_chats").insert(
            {
                "agent_id": agent_id,
                "role": "assistant",
                "content": reply,
                "metadata": {
                    "model": MODEL,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "cost_estimate": round(cost_estimate, 6),
                },
            }
        ).execute()

        print(f"  ✓ {agent_name}: Yanıt gönderildi ({total_tokens} token, ${cost_estimate:.4f})")

    except Exception as e:
        print(f"  ✗ {agent_name}: Claude API hatası: {e}")
        traceback.print_exc()


def check_chat_messages():
    """Tüm aktif agent'lar için cevapsız mesajları kontrol eder."""
    agents_resp = (
        supabase.table("ops_agents")
        .select("id,name,code,department,description,capabilities")
        .eq("is_active", True)
        .execute()
    )
    agents = agents_resp.data or []

    for agent in agents:
        try:
            last_msg_resp = (
                supabase.table("agent_chats")
                .select("*")
                .eq("agent_id", agent["id"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            if last_msg_resp.data and last_msg_resp.data[0]["role"] == "user":
                handle_chat_reply(agent, last_msg_resp.data[0])
        except Exception as e:
            print(f"  ✗ {agent.get('name', '?')}: Kontrol hatası: {e}")


# ─── Main Loop ────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("VigoWood Task Watcher başlatıldı")
    print(f"  Model: {MODEL}")
    print(f"  Poll aralığı: {POLL_INTERVAL}s")
    print("=" * 50)

    while True:
        try:
            check_chat_messages()
        except Exception as e:
            print(f"Döngü hatası: {e}")
            traceback.print_exc()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
