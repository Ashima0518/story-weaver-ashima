from pydantic import BaseModel, Field
from typing import Literal, List, Optional


# ── Structured JSON LLM Output Models ──────────────────────────────────────────

class StoryBlock(BaseModel):
    type: Literal["paragraph", "dialogue"]
    text: str
    speaker: Optional[str] = None  # Only used if type == dialogue

class ChoiceOption(BaseModel):
    id: str
    title: str
    teaser: str

class CharacterState(BaseModel):
    name: str
    state: str

class ContinuityUpdates(BaseModel):
    characters: List[CharacterState] = Field(default_factory=list)
    new_facts: List[str] = Field(default_factory=list)
    open_threads: List[str] = Field(default_factory=list)

class StoryScene(BaseModel):
    scene_title: str = "Untitled Scene"
    hook: str = ""
    mood: str = "Neutral"
    location: str = "Unknown Location"
    story_blocks: List[StoryBlock] = Field(default_factory=list)
    choice_options: List[ChoiceOption] = Field(default_factory=list)
    continuity_updates: ContinuityUpdates = Field(default_factory=ContinuityUpdates)
    one_line_recap: str = "The story advances."


# ── Shared story context (included in every request) ──────────────────────────

class MemoryState(BaseModel):
    characters: List[CharacterState] = Field(default_factory=list)
    new_facts: List[str] = Field(default_factory=list)
    open_threads: List[str] = Field(default_factory=list)

class StoryContext(BaseModel):
    """
    Carries the full story state from the client.
    The backend is stateless — the client owns and sends this every time.
    """
    title: str
    genre: Literal["Fantasy", "Sci-Fi", "Mystery", "Romance", "Horror", "Comedy"]
    initial_hook: str
    total_scenes: Literal[8, 12]
    current_scene: int
    # Full scene texts + structured memory sent with every request
    past_recaps: List[str] = Field(default_factory=list)
    past_scene_texts: List[str] = Field(default_factory=list)
    memory_state: MemoryState = Field(default_factory=MemoryState)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


# ── Request bodies ─────────────────────────────────────────────────────────────

class StartStoryRequest(BaseModel):
    title: str
    genre: Literal["Fantasy", "Sci-Fi", "Mystery", "Romance", "Horror", "Comedy"]
    initial_hook: str
    total_scenes: Literal[8, 12] = Field(default=8)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

class ContinueStoryRequest(StoryContext):
    user_addition: str = ""
    include_choices: bool = True

class VisualPromptRequest(BaseModel):
    scene_text: str

# ── Response bodies ────────────────────────────────────────────────────────────

class StoryResponse(BaseModel):
    scene: StoryScene

class ChoicesResponse(BaseModel):
    choices: List[ChoiceOption]

class VisualPromptResponse(BaseModel):
    visual_prompt: str
