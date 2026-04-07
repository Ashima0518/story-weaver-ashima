from models import MemoryState
from typing import List

# Genre-specific voice direction so the model doesn't default to generic adventure prose
GENRE_VOICE = {
    "Fantasy": "Write like a myth being told around a fire. Earthy, tactile language. Swords have weight, magic has cost, forests feel ancient. Avoid anything that reads like a video game quest log.",
    "Sci-Fi": "Write like a field report from the edge of known space. Technical details should feel lived-in, not exposition. Silences are heavy. Technology is familiar to the characters, never explained to the reader.",
    "Mystery": "Write like a detective's notebook turned into prose. Every detail matters. Misdirect without lying. Atmosphere over action — fog, silence, things slightly wrong. Let the reader notice things before the protagonist does.",
    "Romance": "Write like stolen glances across a room. Tension lives in the unsaid. Physical details are specific — the exact way someone holds a cup, a breath caught. Never rush the emotional beats.",
    "Horror": "Write like something is watching from just outside the frame. Wrongness builds slowly. Ordinary things feel slightly off. Don't explain the threat — let the reader's imagination do the heavy lifting. Restraint is scarier than spectacle.",
    "Comedy": "Write with sharp timing. The humor comes from situations and character voice, not from narration winking at the reader. Deadpan over slapstick. Let absurdity escalate naturally.",
}

def build_system_prompt(title: str, genre: str) -> str:
    voice = GENRE_VOICE.get(genre, "Write with clarity and confidence. Every sentence should earn its place.")

    return f"""You are the narrator of "{title}", a {genre} story.

Voice & craft:
{voice}

Rules for every scene:
- Show, don't tell. If a character is scared, describe their hands shaking — don't write "she felt afraid."
- Write 160–220 words. Exactly ONE scene. 2–3 dense paragraphs.
- Dialogue is optional. Use it only when silence won't do. When you do write dialogue, keep it short and sharp — people don't give speeches in the middle of action.
- End every scene on a small hook — a sound, a question, a door opening. Never end flat.
- Never summarize. Never recap. Never explain what just happened. Trust the reader.

You MUST return strict JSON matching this schema (no markdown, no explanation):
{{
  "scene_title": "string",
  "hook": "string — one punchy opening line that drops the reader into the moment",
  "mood": "string",
  "location": "string",
  "story_blocks": [
    {{
      "type": "paragraph" | "dialogue",
      "speaker": "string or null",
      "text": "string"
    }}
  ],
  "choice_options": [
    {{
      "id": "string",
      "title": "string — a short action, not a summary",
      "teaser": "string — what this choice risks or reveals"
    }}
  ],
  "continuity_updates": {{
    "characters": [
       {{"name": "string", "state": "string — current emotional or physical state"}}
    ],
    "new_facts": ["string"],
    "open_threads": ["string"]
  }},
  "one_line_recap": "string — one sentence capturing what happened, for future context"
}}

Provide EXACTLY 3 choice_options unless instructed otherwise. Make them meaningfully different — not just "go left / go right / stay."
Return ONLY the JSON object."""


def _format_memory(memory: MemoryState) -> str:
    chars = ", ".join(f"{c.name} ({c.state})" for c in memory.characters) or "None yet"
    facts = ", ".join(memory.new_facts) or "None yet"
    threads = ", ".join(memory.open_threads) or "None yet"

    return f"""Characters: {chars}
Established facts: {facts}
Unresolved threads: {threads}"""


def build_start_prompt(initial_hook: str, total_scenes: int) -> str:
    return f"""This is Scene 1 of {total_scenes}. The very beginning.

The user gave you this opening:
"{initial_hook}"

Build the world from this. Introduce the setting, the protagonist, and the central tension. Don't rush — this is the foundation. Plant at least one detail that could matter later.

For this opening scene, do NOT provide branching options. Set choice_options to an EMPTY array []."""


def build_continue_prompt(memory: MemoryState, user_addition: str, current_scene: int, total_scenes: int, past_scene_texts: List[str] = None, include_choices: bool = True) -> str:
    # Full story text for exact prose reference
    if past_scene_texts:
        full_text = "\n\n".join(f"[Scene {i+1}]\n{text}" for i, text in enumerate(past_scene_texts))
        story_text_section = f"Full story text so far:\n\"\"\"\n{full_text}\n\"\"\""
    else:
        story_text_section = ""

    memory_block = _format_memory(memory)

    if user_addition.strip():
        action = f'The user chose: "{user_addition}"'
    else:
        action = "Continue naturally from where the last scene left off."

    target_scene = current_scene + 1
    position = target_scene / total_scenes
    if position <= 0.25:
        pacing = "We're still early. Build atmosphere. Deepen the world. Let tension simmer."
    elif position <= 0.6:
        pacing = "Middle of the story. Raise the stakes. Introduce complications. Make the protagonist's goal harder to reach."
    elif position < 1.0:
        pacing = "We're approaching the climax. Accelerate. Threads should start converging. Choices should feel consequential."
    else:
        pacing = f"""THIS IS THE FINAL SCENE (Scene {target_scene} of {total_scenes}). This is the LAST page of the story.
You MUST bring the narrative to a COMPLETE conclusion. Resolve the central conflict and all open threads. 
Write a definitive ending — the reader should feel the story is finished. Do NOT end on a question, a cliffhanger, or mid-dialogue.
The final paragraph must feel like a closing shot. Set choice_options to an EMPTY array []."""

    # Choice instruction
    if not include_choices and position < 1.0:
        choice_instruction = "Do NOT provide branching options this turn. Set choice_options to an EMPTY array []."
    else:
        choice_instruction = ""

    return f"""{story_text_section}

{memory_block}

{action}

Scene {current_scene} of {total_scenes}. {pacing}
{choice_instruction}"""


def build_choices_prompt(memory: MemoryState, current_scene: int, total_scenes: int, past_scene_texts: List[str] = None) -> str:
    if past_scene_texts:
        full_text = "\n\n".join(f"[Scene {i+1}]\n{text}" for i, text in enumerate(past_scene_texts))
        story_section = f"Full story text so far:\n\"\"\"\n{full_text}\n\"\"\""
    else:
        story_section = ""

    memory_block = _format_memory(memory)

    return f"""{story_section}

{memory_block}

Scene {current_scene} of {total_scenes}.

Based on where the story is RIGHT NOW, suggest 3 meaningfully different paths the NEXT scene could take. These are actions, decisions, or events — not summaries of what already happened.

Return ONLY this JSON:
{{ "choice_options": [ {{ "id": "a", "title": "short action", "teaser": "what this risks or reveals" }}, {{ "id": "b", "title": "...", "teaser": "..." }}, {{ "id": "c", "title": "...", "teaser": "..." }} ] }}

Make them genuinely different — not three flavors of the same thing."""


def build_visual_prompt(scene_text: str) -> tuple[str, str]:
    system = """You extract image generation prompts from story scenes.

Return JSON: { "visual_prompt": "string" }

Rules:
- Describe the visual, not the plot. Camera angle, lighting, color palette, atmosphere.
- Be specific: "golden hour light filtering through cracked cathedral windows" not "beautiful lighting."
- Include a style keyword: cinematic, oil painting, concept art, film noir, etc.
- 1-3 sentences max. No narrative, just visual direction."""

    user = f"""Extract one image generation prompt from this scene:

{scene_text}"""

    return system, user
