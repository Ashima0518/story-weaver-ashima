import os
import json
import time
from groq import Groq
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

_client = Groq(api_key=os.environ["GROQ_API_KEY"])
_model = os.getenv("GROQ_STORY_MODEL", "llama-3.3-70b-versatile")


def call_groq_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 300,
    model_override: str = None,
) -> dict:
    """
    Calls Groq with JSON-mode forced. Retries on 429 with backoff.
    Pass model_override to use a different model than the env default.
    """
    # Only retry for 500/503 errors now. 429s are handled by the frontend UI countdown.
    max_retries = 2
    base_delay = 1.0
    active_model = model_override if model_override else _model

    for attempt in range(max_retries):
        try:
            response = _client.chat.completions.create(
                model=active_model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
            )

            raw_json_str = response.choices[0].message.content.strip()
            return json.loads(raw_json_str)

        except json.JSONDecodeError:
            # 422 — Model returned something that isn't valid JSON (schema confusion)
            raise HTTPException(
                status_code=422,
                detail="The AI returned an unreadable response. Please try again.",
            )

        except Exception as e:
            error_message = str(e).lower()
            status_code = None

            # Try to extract numeric status code from error message
            for code in ["401", "413", "422", "429", "500", "503"]:
                if code in error_message:
                    status_code = int(code)
                    break

            # Also catch keyword patterns
            if status_code is None:
                if "rate limit" in error_message or "too many requests" in error_message:
                    status_code = 429
                elif "unauthorized" in error_message or "api key" in error_message or "authentication" in error_message:
                    status_code = 401
                elif "too large" in error_message or "request entity" in error_message or "payload" in error_message:
                    status_code = 413
                elif "service unavailable" in error_message or "overloaded" in error_message:
                    status_code = 503
                elif "internal server" in error_message:
                    status_code = 500

            # ── 429: Rate limit — Fail immediately and let the frontend show the 10s countdown UI ──
            if status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit reached. Frontend will auto-retry...",
                )

            # ── 401: Auth failure — bad/missing API key ──
            if status_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid API key — check your GROQ_API_KEY in your .env file.",
                )

            # ── 413: Payload too large — story context is too long ──
            if status_code == 413:
                raise HTTPException(
                    status_code=413,
                    detail="The story context is too long. Try trimming older scenes or shortening your recap history.",
                )

            # ── 422: Unprocessable — model couldn't parse our schema ──
            if status_code == 422:
                raise HTTPException(
                    status_code=422,
                    detail="The AI returned an unreadable response. Please try again.",
                )

            # ── 503 / 500: Server-side failures — retry once ──
            if status_code in (500, 503):
                if attempt < 1:
                    sleep_time = base_delay * 2
                    print(f"[{status_code}] Server error. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                    continue
                else:
                    raise HTTPException(
                        status_code=status_code,
                        detail="Something went wrong on Groq's end. Please try again in a moment.",
                    )

            # Generic fallback
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected LLM error: {str(e)}",
            )
