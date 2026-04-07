import type {
  StartStoryRequest,
  ContinueStoryRequest,
  StoryContext,
  StoryResponse,
  ChoicesResponse,
  VisualPromptRequest,
  VisualPromptResponse,
} from "./types";

const API_BASE = "http://localhost:8000";

// ── Typed API Error ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  statusCode: number;
  detail: string;

  constructor(statusCode: number, detail: string) {
    super(detail);
    this.statusCode = statusCode;
    this.detail = detail;
    this.name = "ApiError";
  }
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────
async function fetchApi<T>(endpoint: string, body: any): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Network failure (server down, CORS, etc.)
    throw new ApiError(503, "Cannot reach the server. Make sure the backend is running.");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorData.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const startStory = (data: StartStoryRequest) =>
  fetchApi<StoryResponse>("/story/start", data);

export const continueStory = (data: ContinueStoryRequest) =>
  fetchApi<StoryResponse>("/story/continue", data);

export const getChoices = (data: StoryContext) =>
  fetchApi<ChoicesResponse>("/story/choices", data);

export const generateVisualPrompt = (data: VisualPromptRequest) =>
  fetchApi<VisualPromptResponse>("/story/visualize", data);
