"""Mermaid diagram templates and generators for visual learning."""
from __future__ import annotations

from app.services.textutils import clean_label, extract_definitions, keywords, short_label, split_sentences, title_case

KINDS = [
    "flowchart", "mindmap", "architecture", "sequence", "state", "decision_tree", "concept_map", "er", "network",
    "binary_tree", "heap", "graph", "queue", "stack", "linked_list",
]

TEMPLATES: dict[str, tuple[str, str]] = {
    "stack": (
        "Stack (LIFO)",
        """flowchart TB
    push["push(40)"] --> top
    subgraph S["Stack - Last In, First Out"]
        top["30 (top)"] --> mid["20"] --> bottom["10 (bottom)"]
    end
    top --> pop["pop() returns 30"]""",
    ),
    "queue": (
        "Queue (FIFO)",
        """flowchart LR
    enq["enqueue(40)"] --> rear
    subgraph Q["Queue - First In, First Out"]
        front["10 (front)"] --- b["20"] --- c["30"] --- rear["40 (rear)"]
    end
    front --> deq["dequeue() returns 10"]""",
    ),
    "linked_list": (
        "Singly linked list",
        """flowchart LR
    head(["HEAD"]) --> n1["10 | next"] --> n2["20 | next"] --> n3["30 | next"] --> nil(["NULL"])""",
    ),
    "binary_tree": (
        "Binary search tree",
        """graph TD
    A((50)) --> B((30))
    A --> C((70))
    B --> D((20))
    B --> E((40))
    C --> F((60))
    C --> G((80))""",
    ),
    "heap": (
        "Min-heap",
        """graph TD
    A((1)) --> B((3))
    A --> C((2))
    B --> D((7))
    B --> E((5))
    C --> F((4))
    C --> G((6))
    arr["Array form: 1 3 2 7 5 4 6"] -.-> A""",
    ),
    "graph": (
        "Weighted undirected graph",
        """graph LR
    A((A)) ---|4| B((B))
    A ---|2| C((C))
    B ---|5| D((D))
    C ---|1| B
    C ---|8| D""",
    ),
    "state": (
        "Process state diagram",
        """stateDiagram-v2
    [*] --> New
    New --> Ready: admitted
    Ready --> Running: scheduler dispatch
    Running --> Ready: time slice over
    Running --> Waiting: I/O or event wait
    Waiting --> Ready: I/O or event done
    Running --> Terminated: exit
    Terminated --> [*]""",
    ),
    "sequence": (
        "System call sequence",
        """sequenceDiagram
    participant App as User process
    participant K as Kernel
    participant HW as Hardware
    App->>K: system call (trap)
    K->>K: switch to kernel mode
    K->>HW: start I/O request
    HW-->>K: interrupt when done
    K-->>App: return result in user mode""",
    ),
    "er": (
        "Entity relationship diagram",
        """erDiagram
    STUDENT ||--o{ ENROLLMENT : makes
    COURSE ||--o{ ENROLLMENT : has
    STUDENT {
        int id PK
        string name
    }
    COURSE {
        int id PK
        string title
    }""",
    ),
    "network": (
        "Network diagram",
        """flowchart LR
    Client["Client"] --> Router["Router"] --> Switch["Switch"] --> Server["Server"]
    Router --> Internet(("Internet"))
    Server --> DB[("Database")]""",
    ),
    "decision_tree": (
        "CPU scheduling decision tree",
        """flowchart TD
    Q1{"Is the workload interactive?"} -->|Yes| Q2{"Need fairness?"}
    Q1 -->|No| A["Batch: FCFS or SJF"]
    Q2 -->|Yes| B["Round Robin"]
    Q2 -->|No| C["Priority scheduling"]""",
    ),
    "architecture": (
        "Layered operating system architecture",
        """flowchart TB
    U["User applications"] --> L["System libraries"] --> S["System call interface"]
    S --> K["Kernel: scheduler, memory manager, file system, drivers"]
    K --> H["Hardware: CPU, memory, disks, devices"]""",
    ),
}

AUTO_RULES: list[tuple[tuple[str, ...], str]] = [
    (("stack",), "stack"),
    (("queue", "fifo"), "queue"),
    (("linked list",), "linked_list"),
    (("heap",), "heap"),
    (("binary tree", "bst", "tree"), "binary_tree"),
    (("graph", "dijkstra", "bfs", "dfs"), "graph"),
    (("state", "lifecycle", "process model", "process"), "state"),
    (("system call", "interrupt", "syscall"), "sequence"),
    (("network", "protocol", "router"), "network"),
    (("er diagram", "database schema", "entity"), "er"),
    (("scheduling", "algorithm choice"), "decision_tree"),
    (("architecture", "kernel", "layer", "structure"), "architecture"),
]


def _terms(topic: str, contexts: list[str], n: int = 6) -> list[str]:
    defs = [t for t, _ in extract_definitions(contexts)]
    words = [title_case(w) for w in keywords(" ".join(contexts), n * 2)]
    seen: set[str] = set()
    out: list[str] = []
    for term in [*defs, *words]:
        label = clean_label(term, 4)
        if label.lower() in seen or label.lower() == topic.lower():
            continue
        seen.add(label.lower())
        out.append(label)
        if len(out) >= n:
            break
    return out


def flowchart_from_context(topic: str, contexts: list[str], ranked: list[str] | None = None) -> str:
    """Process-style flowchart. `ranked` lets callers pass the most relevant sentences first."""
    sentences = (ranked or [s for text in contexts for s in split_sentences(text)])[:5]
    if not sentences:
        return f'flowchart TD\n    A["{clean_label(topic)}"] --> B["Key idea"] --> C["Example"] --> D["Summary"]'
    lines = ["flowchart TD", f'    S(["{clean_label(topic, 5)}"])']
    prev = "S"
    for i, sentence in enumerate(sentences):
        node = f"N{i}"
        lines.append(f'    {prev} --> {node}["{short_label(sentence)}"]')
        prev = node
    lines.append(f'    {prev} --> E(["Check understanding"])')
    return "\n".join(lines)


def mindmap_from_context(topic: str, contexts: list[str]) -> str:
    terms = _terms(topic, contexts, 6)
    lines = ["mindmap", f"  root(({clean_label(topic, 4)}))"]
    for term in terms or ["Definition", "Examples", "Applications"]:
        lines.append(f"    {term}")
    return "\n".join(lines)


def concept_map_from_context(topic: str, contexts: list[str]) -> str:
    terms = _terms(topic, contexts, 5)
    root = clean_label(topic, 4)
    lines = ["flowchart LR", f'    R(["{root}"])']
    relations = ["includes", "uses", "depends on", "produces", "is part of"]
    for i, term in enumerate(terms or ["Definition", "Example"]):
        lines.append(f'    R -->|{relations[i % len(relations)]}| C{i}["{term}"]')
    for i in range(len(terms) - 1):
        if i % 2 == 0:
            lines.append(f"    C{i} -.-> C{i + 1}")
    return "\n".join(lines)


def generate_visual(topic: str, kind: str, contexts: list[str] | None = None) -> tuple[str, str]:
    """Return (title, mermaid code). Context-driven for generic kinds, template-driven for structures."""
    contexts = contexts or []
    if kind == "flowchart":
        return f"Flowchart: {topic}", flowchart_from_context(topic, contexts)
    if kind == "mindmap":
        return f"Mind map: {topic}", mindmap_from_context(topic, contexts)
    if kind == "concept_map":
        return f"Concept map: {topic}", concept_map_from_context(topic, contexts)
    if kind in TEMPLATES:
        title, code = TEMPLATES[kind]
        return title, code
    return f"Flowchart: {topic}", flowchart_from_context(topic, contexts)


def auto_visuals(topic: str, contexts: list[str]) -> list[tuple[str, str, str]]:
    """Pick diagrams that suit a topic: [(kind, title, mermaid)]."""
    lowered = topic.lower()
    picks: list[str] = []
    for needles, kind in AUTO_RULES:
        if any(n in lowered for n in needles) and kind not in picks:
            picks.append(kind)
    out: list[tuple[str, str, str]] = []
    for kind in picks[:1]:
        title, code = TEMPLATES[kind]
        out.append((kind, title, code))
    title, code = generate_visual(topic, "mindmap", contexts)
    out.append(("mindmap", title, code))
    return out
