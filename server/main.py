import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import (
    StartStoryRequest,
    ContinueStoryRequest,
    StoryResponse,
    StoryScene,
    StoryContext,
    ChoicesResponse,
    ChoiceOption,
    VisualPromptRequest,
    VisualPromptResponse
)
from prompts import (
    build_system_prompt,
    build_start_prompt,
    build_continue_prompt,
    build_choices_prompt,
    build_visual_prompt,
)
from llm import call_groq_json


app = FastAPI(
    title="Story Weaver API",
    description="AI-powered collaborative storytelling backend using cinematic JSON.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:5175", 
        "http://localhost:5176",
        "http://localhost:3000"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/story/start", response_model=StoryResponse)
def start_story(req: StartStoryRequest):
    system_prompt = build_system_prompt(req.title, req.genre)
    user_prompt   = build_start_prompt(req.initial_hook, req.total_scenes)

    ai_json = call_groq_json(system_prompt, user_prompt, req.temperature, max_tokens=800)
    scene = StoryScene(**ai_json)
    return StoryResponse(scene=scene)


@app.post("/story/continue", response_model=StoryResponse)
def continue_story(req: ContinueStoryRequest):
    system_prompt = build_system_prompt(req.title, req.genre)
    user_prompt   = build_continue_prompt(
        memory=req.memory_state,
        user_addition=req.user_addition,
        current_scene=req.current_scene,
        total_scenes=req.total_scenes,
        past_scene_texts=req.past_scene_texts,
        include_choices=req.include_choices,
    )

    ai_json = call_groq_json(system_prompt, user_prompt, req.temperature, max_tokens=800)
    scene = StoryScene(**ai_json)
    return StoryResponse(scene=scene)


@app.post("/story/choices", response_model=ChoicesResponse)
def get_story_choices(req: StoryContext):
    system_prompt = build_system_prompt(req.title, req.genre)
    user_prompt = build_choices_prompt(
        memory=req.memory_state,
        current_scene=req.current_scene,
        total_scenes=req.total_scenes,
        past_scene_texts=req.past_scene_texts,
    )

    ai_json = call_groq_json(system_prompt, user_prompt, req.temperature, max_tokens=300)
    raw_choices = ai_json.get("choice_options", [])
    choices = [ChoiceOption(**c) for c in raw_choices]
    return ChoicesResponse(choices=choices)


@app.post("/story/visualize", response_model=VisualPromptResponse)
def generate_visual_prompt(req: VisualPromptRequest):
    system_prompt, user_prompt = build_visual_prompt(req.scene_text)
    visual_model = os.getenv("GROQ_VISUAL_MODEL", "llama-3.1-8b-instant")
    ai_json = call_groq_json(
        system_prompt,
        user_prompt,
        temperature=0.5,
        max_tokens=200,
        model_override=visual_model
    )
    return VisualPromptResponse(visual_prompt=ai_json.get("visual_prompt", "A dramatic fantasy scene, cinematic lighting, conceptual art"))
