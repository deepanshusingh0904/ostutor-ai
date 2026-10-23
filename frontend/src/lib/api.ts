import { API_URL } from "./constants";
import { getToken, persistToken, useAuthStore } from "./auth-store";
import type {
  AdminStats, Bookmark, ChatMode, Conversation, ConversationDetail, Dashboard, Deck, Difficulty, DocumentItem,
  Flashcard, GuideKind, QuestionType, Quiz, QuizAttempt, QuizSummary, SearchResults, StudyGuide, TokenResponse, User,
  UserSettings, VivaSession, Visual, VisualKind, Citation,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; form?: FormData; auth?: boolean };

async function request<T>(path: string, { json, form, auth = true, headers, ...init }: Options = {}): Promise<T> {
  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  if (json !== undefined) finalHeaders["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: finalHeaders,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the OSTutor server. Is the backend running?");
  }
  if (response.status === 401 && auth) {
    persistToken(null);
    useAuthStore.getState().setUser(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) window.location.href = "/login";
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && search.set(k, String(v)));
  const s = search.toString();
  return s ? `?${s}` : "";
};

export const api = {
  auth: {
    login: (email: string, password: string) => request<TokenResponse>("/api/auth/login", { method: "POST", json: { email, password }, auth: false }),
    register: (email: string, password: string, full_name: string) =>
      request<TokenResponse>("/api/auth/register", { method: "POST", json: { email, password, full_name }, auth: false }),
    me: () => request<User>("/api/auth/me"),
    config: () => request<{ google_client_id: string }>("/api/auth/config", { auth: false }),
    google: (credential: string) => request<TokenResponse>("/api/auth/google", { method: "POST", json: { credential }, auth: false }),
  },
  users: {
    update: (data: Partial<Pick<User, "full_name" | "bio" | "university">>) => request<User>("/api/users/me", { method: "PUT", json: data }),
    changePassword: (current_password: string, new_password: string) =>
      request<void>("/api/users/me/password", { method: "PUT", json: { current_password, new_password } }),
    updateSettings: (data: Partial<UserSettings>) => request<UserSettings>("/api/users/me/settings", { method: "PUT", json: data }),
  },
  documents: {
    list: () => request<DocumentItem[]>("/api/documents"),
    get: (id: number) => request<DocumentItem>(`/api/documents/${id}`),
    upload: (file: File, title: string, subject: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      form.append("subject", subject);
      return request<DocumentItem>("/api/documents", { method: "POST", form });
    },
    reindex: (id: number) => request<DocumentItem>(`/api/documents/${id}/reindex`, { method: "POST" }),
    remove: (id: number) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
  },
  chat: {
    list: (q?: string, mode?: ChatMode) => request<Conversation[]>(`/api/chat/conversations${qs({ q, mode })}`),
    create: (mode: ChatMode) => request<Conversation>("/api/chat/conversations", { method: "POST", json: { mode } }),
    get: (id: number) => request<ConversationDetail>(`/api/chat/conversations/${id}`),
    update: (id: number, data: { title?: string; pinned?: boolean }) =>
      request<Conversation>(`/api/chat/conversations/${id}`, { method: "PATCH", json: data }),
    remove: (id: number) => request<void>(`/api/chat/conversations/${id}`, { method: "DELETE" }),
  },
  quiz: {
    generate: (data: { topic: string; difficulty: Difficulty; types: QuestionType[]; count: number }) =>
      request<Quiz>("/api/quizzes", { method: "POST", json: data }),
    list: () => request<QuizSummary[]>("/api/quizzes"),
    get: (id: number) => request<Quiz>(`/api/quizzes/${id}`),
    submit: (id: number, answers: Record<string, string>, duration_seconds: number) =>
      request<QuizAttempt>(`/api/quizzes/${id}/submit`, { method: "POST", json: { answers, duration_seconds } }),
    remove: (id: number) => request<void>(`/api/quizzes/${id}`, { method: "DELETE" }),
  },
  viva: {
    start: (topic: string, difficulty: Difficulty, max_questions: number) =>
      request<VivaSession>("/api/viva", { method: "POST", json: { topic, difficulty, max_questions } }),
    history: () => request<VivaSession[]>("/api/viva"),
    answer: (id: number, answer: string) => request<VivaSession>(`/api/viva/${id}/answer`, { method: "POST", json: { answer } }),
  },
  flashcards: {
    decks: () => request<Deck[]>("/api/flashcards/decks"),
    create: (topic: string, count: number) => request<Deck>("/api/flashcards/decks", { method: "POST", json: { topic, count } }),
    cards: (deckId: number, dueOnly = false) => request<Flashcard[]>(`/api/flashcards/decks/${deckId}/cards${qs({ due_only: dueOnly })}`),
    review: (cardId: number, rating: number) => request<Flashcard>(`/api/flashcards/cards/${cardId}/review`, { method: "POST", json: { rating } }),
    remove: (deckId: number) => request<void>(`/api/flashcards/decks/${deckId}`, { method: "DELETE" }),
  },
  guides: {
    generate: (topic: string, kind: GuideKind) => request<StudyGuide>("/api/study-guides", { method: "POST", json: { topic, kind } }),
    list: () => request<StudyGuide[]>("/api/study-guides"),
    remove: (id: number) => request<void>(`/api/study-guides/${id}`, { method: "DELETE" }),
  },
  visuals: {
    generate: (topic: string, kind: VisualKind) => request<Visual>("/api/visuals", { method: "POST", json: { topic, kind } }),
  },
  bookmarks: {
    list: (q?: string, kind?: string) => request<Bookmark[]>(`/api/bookmarks${qs({ q, kind })}`),
    create: (data: { kind: Bookmark["kind"]; title: string; content?: string; ref_id?: number | null; conversation_id?: number | null }) =>
      request<Bookmark>("/api/bookmarks", { method: "POST", json: data }),
    remove: (id: number) => request<void>(`/api/bookmarks/${id}`, { method: "DELETE" }),
  },
  progress: {
    dashboard: () => request<Dashboard>("/api/progress/dashboard"),
    heartbeat: (seconds: number) => request<{ today_seconds: number }>("/api/progress/heartbeat", { method: "POST", json: { seconds } }),
  },
  search: (q: string) => request<SearchResults>(`/api/search${qs({ q })}`),
  admin: {
    stats: () => request<AdminStats>("/api/admin/stats"),
    users: () => request<User[]>("/api/admin/users"),
    updateUser: (id: number, data: { role?: "student" | "admin"; is_active?: boolean }) =>
      request<User>(`/api/admin/users/${id}`, { method: "PATCH", json: data }),
    removeUser: (id: number) => request<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    testRetrieval: (query: string, top_k = 5) =>
      request<{ query: string; results: Citation[] }>("/api/admin/rag/test", { method: "POST", json: { query, top_k } }),
  },
};
