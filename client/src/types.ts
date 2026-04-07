export type Genre = "Fantasy" | "Sci-Fi" | "Mystery" | "Romance" | "Horror" | "Comedy";

export interface StoryBlock {
  type: "paragraph" | "dialogue";
  text: string;
  speaker?: string | null;
}

export interface ChoiceOption {
  id: string;
  title: string;
  teaser: string;
}

export interface CharacterState {
  name: string;
  state: string;
}

export interface ContinuityUpdates {
  characters: CharacterState[];
  new_facts: string[];
  open_threads: string[];
}

export interface StoryScene {
  scene_title: string;
  hook: string;
  mood: string;
  location: string;
  story_blocks: StoryBlock[];
  choice_options: ChoiceOption[];
  continuity_updates: ContinuityUpdates;
  one_line_recap: string;
}

export interface MemoryState {
  characters: CharacterState[];
  new_facts: string[];
  open_threads: string[];
}

export interface StoryContext {
  title: string;
  genre: Genre;
  initial_hook: string;
  total_scenes: 8 | 12;
  current_scene: number;
  past_recaps: string[];
  past_scene_texts: string[];
  memory_state: MemoryState;
  temperature: number;
}

export interface StartStoryRequest {
  title: string;
  genre: Genre;
  initial_hook: string;
  total_scenes: 8 | 12;
  temperature: number;
}

export interface ContinueStoryRequest extends StoryContext {
  user_addition: string;
  include_choices: boolean;
}

export interface StoryResponse {
  scene: StoryScene;
}

export interface ChoicesResponse {
  choices: ChoiceOption[];
}

export interface VisualPromptRequest {
  scene_text: string;
}

export interface VisualPromptResponse {
  visual_prompt: string;
}
