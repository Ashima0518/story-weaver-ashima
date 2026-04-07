# Story Weaver

An AI-powered collaborative storytelling app. You set up the world, pick a genre, write the opening line — then the AI takes turns with you, scene by scene, until the story ends.

Built with React + Vite on the frontend, FastAPI on the backend, and Groq for LLM inference.

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A free [Groq API key](https://console.groq.com/)

### Backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file inside `server/`:

```
GROQ_API_KEY=your_key_here
GROQ_STORY_MODEL=llama-3.3-70b-versatile
GROQ_VISUAL_MODEL=llama-3.1-8b-instant
```

Start the server:

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite gives you).

---

## Model & Provider

- **Provider:** Groq (free tier)
- **Story generation:** `llama-3.3-70b-versatile` — used for all scene generation. It's the best balance of quality and speed on Groq's free tier. Good at following structured JSON schemas without breaking.
- **Visualization prompts:** `llama-3.1-8b-instant` — a lighter model used only for the image prompt extraction feature. Saves tokens and avoids rate-limiting the main story model.

Both models are configurable via `.env` so you can swap them without touching code.

---

## Prompt Strategy

The system prompt is in `server/prompts.py`. Here's how it works:

The model gets a single system prompt that does three things:
1. Sets the role ("narrator of this specific story") with genre-specific voice direction
2. Defines the exact JSON schema it must return — scene title, hook, story blocks, choices, continuity updates, and a one-line recap
3. Gives strict creative constraints — 160-220 words per scene, 2-3 narrative paragraphs, exactly 3 branching choices, dialogue only when it adds tension

Each genre gets a distinct voice brief. For example, Horror gets: *"Write like something is watching from just outside the frame. Wrongness builds slowly. Ordinary things feel slightly off. Don't explain the threat. Restraint is scarier than spectacle."* Full genre voices are in the `GENRE_VOICE` dict.

For the user prompt, it depends on whether it's the first scene or a continuation:
- **Start:** gets the user's hook text and the total scene count
- **Continue:** gets the past recaps (one-liner summaries of each previous scene), the current memory state (characters, facts, open threads), the user's choice or custom text, and scene pacing instructions that adapt to story position:
  - Early (≤25%): "Build atmosphere. Let tension simmer."
  - Mid (25-60%): "Raise the stakes. Introduce complications."
  - Late (60-99%): "Accelerate. Threads should converge."
  - Final: "Resolve the conflict. Set choice_options to EMPTY []."

<details>
<summary><strong>Full system prompt (click to expand)</strong></summary>

```
You are the narrator of "{title}", a {genre} story.

Voice & craft:
{genre-specific voice direction from GENRE_VOICE dict}

Rules for every scene:
- Show, don't tell. If a character is scared, describe their hands shaking — don't write "she felt afraid."
- Write 160-220 words. Exactly ONE scene. 2-3 dense paragraphs.
- Dialogue is optional. Use it only when silence won't do. When you do write dialogue, keep it short and sharp — people don't give speeches in the middle of action.
- End every scene on a small hook — a sound, a question, a door opening. Never end flat.
- Never summarize. Never recap. Never explain what just happened. Trust the reader.

You MUST return strict JSON matching this schema (no markdown, no explanation):
{
  "scene_title": "string",
  "hook": "string — one punchy opening line that drops the reader into the moment",
  "mood": "string",
  "location": "string",
  "story_blocks": [
    {
      "type": "paragraph" | "dialogue",
      "speaker": "string or null",
      "text": "string"
    }
  ],
  "choice_options": [
    {
      "id": "string",
      "title": "string — a short action, not a summary",
      "teaser": "string — what this choice risks or reveals"
    }
  ],
  "continuity_updates": {
    "characters": [
       {"name": "string", "state": "string — current emotional or physical state"}
    ],
    "new_facts": ["string"],
    "open_threads": ["string"]
  },
  "one_line_recap": "string — one sentence capturing what happened, for future context"
}

Provide EXACTLY 3 choice_options unless instructed otherwise. Make them meaningfully different — not just "go left / go right / stay."
Return ONLY the JSON object.
```

</details>

---

## Memory & Consistency

The backend is fully stateless. The client owns all story state and sends it with every request.

Every continuation call includes the **full prose text** of every previous scene (`past_scene_texts`), so the model always has the exact story history available. On top of that, a structured `memory_state` is sent for quick fact lookup:

- `characters` — name + current emotional/physical state
- `new_facts` — things established as true in the world
- `open_threads` — unresolved plot points

The model updates these fields every scene via `continuity_updates` in its JSON response. The client merges the latest snapshot and sends it back on the next call. This gives the model two complementary views: the exact prose for wording consistency, and a structured index for character/plot tracking.

Context usage stays reasonable — even at 12 scenes × ~200 words, the full text is ~2400 words (~3200 tokens), well within the 128K context window.

---

## Bonus Features

### 1. Undo Last Turn
Pure client-side state rollback. Pops the last scene off the array and decrements the scene counter. No API call needed — the model just gets a shorter story history on the next turn.

### 2. Export to Markdown
When the story ends, you can download the entire narrative as a `.md` file. It compiles all scenes into a clean document with proper headings and dialogue formatting.

### 3. Visualization Prompt Generator
Each scene has a "Generate Image Reference" button. It sends the scene text to a separate `/story/visualize` endpoint (using the smaller 8b model) and extracts a Midjourney/DALL-E style prompt. You get:
- A Copy button
- A "Render on DALL-E" link (sends it to ChatGPT)
- A "Render on FLUX" link (sends you to the HuggingFace Flux.1 space)

### 4. Rate-Limit Retry with Countdown
When the backend receives a 429 from Groq, it immediately returns the error to the frontend — no silent waiting. The frontend catches it and shows a **visible 10-second countdown timer** in the error toast, then automatically retries the exact same request. The user can cancel the retry at any time by dismissing the toast. This means the UI is always transparent about what's happening instead of freezing on a loading spinner.

### 5. Cinematic Reading Mode
When the story completes, the entire UI slides away and a clean, full-screen manuscript overlay appears with just the pure narrative text — no borders, no buttons, no scene labels. It feels like reading a finished story, not staring at a chat log. The export and restart buttons sit at the bottom.

---

## What Didn't Work Well at First

**Scene density.** My first version asked the model to generate scenes without strict word count guidelines. The result was either:
- Tiny 2-sentence scenes that felt like bullet points
- Massive multi-page dumps that killed the interactive pacing

The fix was adding explicit constraints in the system prompt: "160-220 words, 2-3 paragraphs, dialogue only when it adds tension." This hit the sweet spot — each scene is long enough to feel immersive but short enough that clicking "next" still feels interactive.

I also had to add `default_factory` fallbacks to all the Pydantic model fields, because when the model hit the token limit mid-response, it would return truncated JSON that was missing fields. Instead of crashing the server, it now gracefully fills in defaults.

---

## What I'd Improve with More Time

- **Streaming responses.** Right now the user stares at a loading spinner for 3-5 seconds per scene. Streaming the JSON and rendering blocks progressively would feel way better.
- **Better memory rollback on undo.** Currently undo rolls back scenes and recaps but doesn't perfectly restore the memory state to what it was two scenes ago. I'd need to keep a history stack of memory snapshots.
- **Character portraits.** Use the visualization prompt system to auto-generate consistent character portraits on first introduction and display them next to dialogue blocks.
- **Collaborative multiplayer.** Two users taking alternating turns writing the next scene, with the AI filling in the gaps.
- **Mobile layout polish.** The current layout works on mobile but the action bar gets cramped. I'd invest time in a proper mobile-first bottom sheet UI.

---

## Project Structure

```
story-weaver/
├── server/
│   ├── main.py            # FastAPI routes
│   ├── llm.py             # Groq client, retry logic, error handling
│   ├── models.py          # Pydantic schemas (request/response/scene)
│   ├── prompts.py         # All prompt construction
│   ├── requirements.txt
│   ├── .env               # Your API key (not committed)
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── App.tsx         # Root state management, error handling
│   │   ├── SetupScreen.tsx # Story setup form (title, genre, hook, length)
│   │   ├── StoryScreen.tsx # Main story view, choices, visual prompts, reading mode
│   │   ├── api.ts          # Typed fetch wrapper with error classes
│   │   ├── types.ts        # Shared TypeScript interfaces
│   │   └── index.css       # Global styles, animations
│   └── package.json
└── README.md
```
