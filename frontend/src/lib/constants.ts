import type { Difficulty, GuideKind, QuestionType, VisualKind } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const TOKEN_KEY = "ostutor.token";
export const TOKEN_COOKIE = "ostutor_token";

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the blanks" },
  { value: "coding", label: "Coding" },
  { value: "numerical", label: "Numericals" },
];

export const GUIDE_KINDS: { value: GuideKind; label: string; hint: string }[] = [
  { value: "summary", label: "Summary", hint: "The big picture in a few minutes" },
  { value: "revision_notes", label: "Revision notes", hint: "Tight bullets for last-minute review" },
  { value: "formula_sheet", label: "Formula sheet", hint: "Every formula with when to use it" },
  { value: "mind_map", label: "Mind map", hint: "Concepts as a visual map" },
  { value: "cheat_sheet", label: "Cheat sheet", hint: "Definitions, tables and pitfalls" },
  { value: "expected_questions", label: "Expected questions", hint: "Likely exam questions" },
];

export const VISUAL_KINDS: { value: VisualKind; label: string }[] = [
  { value: "flowchart", label: "Flowchart" },
  { value: "mindmap", label: "Mind map" },
  { value: "architecture", label: "Architecture" },
  { value: "sequence", label: "Sequence diagram" },
  { value: "state", label: "State diagram" },
  { value: "decision_tree", label: "Decision tree" },
  { value: "concept_map", label: "Concept map" },
  { value: "er", label: "ER diagram" },
  { value: "network", label: "Network diagram" },
  { value: "binary_tree", label: "Binary tree" },
  { value: "heap", label: "Heap" },
  { value: "graph", label: "Graph" },
  { value: "queue", label: "Queue" },
  { value: "stack", label: "Stack" },
  { value: "linked_list", label: "Linked list" },
];

export const PROFESSOR_PROMPTS = [
  "Teach me about deadlock",
  "Teach me CPU scheduling",
  "Help me understand paging and virtual memory",
  "Explain process synchronization with semaphores",
];

export const CHAT_PROMPTS = [
  "What is a context switch?",
  "Compare FCFS, SJF and Round Robin scheduling",
  "Draw a diagram of the process state model",
  "What causes thrashing?",
];
