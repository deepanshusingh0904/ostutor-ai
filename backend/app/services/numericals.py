"""Parametrised numerical problem generators with fully worked solutions (OS / systems themed)."""
from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class Numerical:
    topic: str
    question: str
    answer: str
    tolerance: float
    explanation: str


def _sizes(difficulty: str) -> int:
    return {"easy": 3, "medium": 4, "hard": 5}.get(difficulty, 4)


def fcfs_waiting(rng: random.Random, difficulty: str) -> Numerical:
    n = _sizes(difficulty)
    bursts = [rng.randint(2, 12) for _ in range(n)]
    waits, clock = [], 0
    for b in bursts:
        waits.append(clock)
        clock += b
    avg = sum(waits) / n
    names = [f"P{i + 1}" for i in range(n)]
    steps = "; ".join(f"{p} waits {w}" for p, w in zip(names, waits))
    return Numerical(
        "FCFS scheduling",
        f"Processes {', '.join(names)} all arrive at time 0 with CPU burst times {bursts} ms. "
        "Using First-Come-First-Served scheduling, what is the average waiting time (in ms)?",
        f"{avg:.2f}", 0.01,
        f"Run the processes in arrival order. Waiting time = start time - arrival time. {steps}. "
        f"Average = ({' + '.join(map(str, waits))}) / {n} = {avg:.2f} ms.",
    )


def sjf_waiting(rng: random.Random, difficulty: str) -> Numerical:
    n = _sizes(difficulty)
    bursts = [rng.randint(2, 12) for _ in range(n)]
    ordered = sorted(bursts)
    waits, clock = [], 0
    for b in ordered:
        waits.append(clock)
        clock += b
    avg = sum(waits) / n
    return Numerical(
        "SJF scheduling",
        f"{n} processes arrive at time 0 with burst times {bursts} ms. Using non-preemptive Shortest Job First, "
        "what is the average waiting time (in ms)?",
        f"{avg:.2f}", 0.01,
        f"Sort bursts ascending: {ordered}. Waiting times are the cumulative start times: {waits}. "
        f"Average = {sum(waits)} / {n} = {avg:.2f} ms.",
    )


def fifo_faults(rng: random.Random, difficulty: str) -> Numerical:
    length = {"easy": 10, "medium": 12, "hard": 15}.get(difficulty, 12)
    frames = 3
    refs = [rng.randint(0, 5) for _ in range(length)]
    memory: list[int] = []
    faults = 0
    trace = []
    for r in refs:
        if r not in memory:
            faults += 1
            if len(memory) == frames:
                memory.pop(0)
            memory.append(r)
            trace.append(f"{r}:fault")
        else:
            trace.append(f"{r}:hit")
    return Numerical(
        "FIFO page replacement",
        f"A system has {frames} page frames (initially empty). The page reference string is {refs}. "
        "How many page faults occur under FIFO replacement?",
        str(faults), 0,
        f"Process each reference and replace the oldest page when memory is full. Trace: {', '.join(trace)}. "
        f"Total page faults = {faults}.",
    )


def effective_access_time(rng: random.Random, difficulty: str) -> Numerical:
    hit = rng.choice([0.8, 0.85, 0.9, 0.95, 0.98])
    tlb = rng.choice([10, 15, 20])
    mem = rng.choice([100, 120, 150, 200])
    eat = hit * (tlb + mem) + (1 - hit) * (tlb + 2 * mem)
    return Numerical(
        "Effective memory access time",
        f"A paging system uses a TLB with hit ratio {hit:.2f}. TLB lookup takes {tlb} ns and a memory access takes "
        f"{mem} ns (single-level page table). What is the effective access time in ns?",
        f"{eat:.2f}", 0.5,
        f"EAT = h x (t + m) + (1 - h) x (t + 2m) = {hit} x {tlb + mem} + {1 - hit:.2f} x {tlb + 2 * mem} = {eat:.2f} ns.",
    )


def paging_address(rng: random.Random, difficulty: str) -> Numerical:
    page_size = rng.choice([512, 1024, 2048, 4096])
    address = rng.randint(page_size, page_size * 12 - 1)
    page, offset = divmod(address, page_size)
    return Numerical(
        "Paging address translation",
        f"With a page size of {page_size} bytes, what is the page number of logical address {address}?",
        str(page), 0,
        f"Page number = floor({address} / {page_size}) = {page}; offset = {address} mod {page_size} = {offset}.",
    )


def disk_fcfs(rng: random.Random, difficulty: str) -> Numerical:
    n = {"easy": 4, "medium": 5, "hard": 6}.get(difficulty, 5)
    head = rng.randint(20, 120)
    requests = [rng.randint(0, 199) for _ in range(n)]
    total, pos = 0, head
    for r in requests:
        total += abs(r - pos)
        pos = r
    return Numerical(
        "Disk scheduling (FCFS)",
        f"The disk head is at cylinder {head}. Pending requests (in arrival order): {requests}. "
        "What is the total head movement under FCFS disk scheduling?",
        str(total), 0,
        f"Sum the absolute differences in service order starting from {head}: total = {total} cylinders.",
    )


GENERATORS = {
    "fcfs": fcfs_waiting, "sjf": sjf_waiting, "fifo": fifo_faults, "eat": effective_access_time,
    "paging": paging_address, "disk": disk_fcfs,
}
KEYWORDS = [
    (("fcfs", "first come", "scheduling", "cpu"), "fcfs"),
    (("sjf", "shortest"), "sjf"),
    (("fifo", "replacement", "page fault", "virtual memory"), "fifo"),
    (("tlb", "access time", "cache"), "eat"),
    (("paging", "address", "memory management", "memory"), "paging"),
    (("disk", "seek", "i/o"), "disk"),
]


def generate(topic: str, difficulty: str = "medium", rng: random.Random | None = None) -> Numerical:
    rng = rng or random.Random()
    lowered = topic.lower()
    candidates = [name for needles, name in KEYWORDS if any(n in lowered for n in needles)]
    key = rng.choice(candidates) if candidates else rng.choice(list(GENERATORS))
    return GENERATORS[key](rng, difficulty)
