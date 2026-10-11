export type Role = "student" | "admin";
export type Difficulty = "easy" | "medium" | "hard";
export type ChatMode = "chat" | "professor";
export type QuestionType = "mcq" | "true_false" | "fill_blank" | "coding" | "numerical";

export interface UserSettings {
  theme: "light" | "dark" | "system";
  default_difficulty: Difficulty;
  professor_style: "balanced" | "socratic" | "concise";
  daily_goal_minutes: number;
  stream_responses: boolean;
  show_citations: boolean;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  bio: string;
  university: string;
  settings: UserSettings;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Citation {
  index: number;
  document_id: number;
  document_name: string;
  page: number;
  text: string;
  score: number;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  mode: ChatMode;
  topic: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface DocumentItem {
  id: number;
  title: string;
  filename: string;
  file_type: string;
  subject: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  error: string;
  uploaded_by: number | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  topic: string;
  difficulty: Difficulty;
  source?: string;
}

export interface Quiz {
  id: number;
  topic: string;
  difficulty: Difficulty;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizSummary {
  id: number;
  topic: string;
  difficulty: Difficulty;
  created_at: string;
  question_count: number;
  best_score: number | null;
}

export interface QuizResult {
  id: string;
  type: QuestionType;
  question: string;
  given: string;
  correct: boolean;
  points: number;
  answer: string;
  explanation: string;
  options?: string[] | null;
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  score: number;
  total: number;
  results: QuizResult[];
  duration_seconds: number;
  created_at: string;
}

export interface VivaTurn {
  question: string;
  answer: string | null;
  score?: number;
  feedback?: string;
  missing?: string[];
  reference_answer?: string;
}

export interface VivaSession {
  id: number;
  topic: string;
  difficulty: Difficulty;
  max_questions: number;
  status: "active" | "completed";
  transcript: VivaTurn[];
  final_score: number | null;
  final_feedback: string;
  created_at: string;
}

export interface Deck {
  id: number;
  topic: string;
  created_at: string;
  card_count: number;
  due_count: number;
}

export interface Flashcard {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  source: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
}

export interface Bookmark {
  id: number;
  kind: "message" | "document" | "topic" | "guide";
  title: string;
  content: string;
  ref_id: number | null;
  conversation_id: number | null;
  created_at: string;
}

export type GuideKind = "summary" | "revision_notes" | "formula_sheet" | "mind_map" | "cheat_sheet" | "expected_questions";

export interface StudyGuide {
  id: number;
  topic: string;
  kind: GuideKind;
  content: string;
  citations: Citation[];
  created_at: string;
}

export type VisualKind =
  | "flowchart" | "mindmap" | "architecture" | "sequence" | "state" | "decision_tree" | "concept_map" | "er"
  | "network" | "binary_tree" | "heap" | "graph" | "queue" | "stack" | "linked_list";

export interface Visual {
  kind: VisualKind;
  topic: string;
  title: string;
  mermaid: string;
}

export interface TopicStat {
  topic: string;
  accuracy: number;
  attempts: number;
  last_studied: string;
}

export interface Dashboard {
  streak: number;
  today_minutes: number;
  total_minutes: number;
  daily_goal_minutes: number;
  week: { date: string; label: string; minutes: number }[];
  quiz_accuracy: number | null;
  quizzes_taken: number;
  viva_average: number | null;
  vivas_completed: number;
  flashcards_due: number;
  weak_topics: TopicStat[];
  strong_topics: TopicStat[];
  topics: TopicStat[];
  recent_attempts: { id: number; topic: string; percent: number; date: string }[];
  recent_chats: { id: number; title: string; mode: ChatMode; updated_at: string }[];
  recent_bookmarks: { id: number; title: string; kind: string; conversation_id: number | null }[];
  documents_available: number;
}

export interface SearchResults {
  query: string;
  passages: Citation[];
  conversations: { id: number; title: string; mode: ChatMode; updated_at: string }[];
  bookmarks: { id: number; title: string; kind: string; conversation_id: number | null }[];
  guides: { id: number; topic: string; kind: string }[];
}

export interface AdminStats {
  users: number;
  admins: number;
  active_users_7d: number;
  documents: number;
  documents_ready: number;
  documents_failed: number;
  chunks: number;
  conversations: number;
  messages: number;
  quizzes: number;
  quiz_attempts: number;
  vivas: number;
  llm_configured: boolean;
  llm_model: string | null;
  embedding_model: string;
  vector_collection: string;
}

export type StreamEvent =
  | { type: "meta"; conversation_id: number; user_message_id: number; title: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "token"; content: string }
  | { type: "done"; message_id: number; content: string; title: string }
  | { type: "error"; message: string };
