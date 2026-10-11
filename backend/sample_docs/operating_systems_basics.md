# Operating Systems Basics

## Processes

A process is a program in execution, together with its current activity such as the program counter, registers and stack. A process is an active entity, while a program is a passive file stored on disk. Each process has its own address space, so one process cannot directly corrupt the memory of another.

A process moves through several states during its life. A new process is admitted to the ready state. The scheduler dispatches a ready process to the running state. A running process may be interrupted when its time slice ends, or it may move to the waiting state while it waits for an I/O event. When the event completes the process returns to the ready state. A process that finishes execution enters the terminated state.

A context switch is the act of saving the state of the running process and loading the saved state of another process. Context switching is pure overhead because the system does no useful work while switching. The state is stored in a data structure called the process control block.

## Threads

A thread is the basic unit of CPU utilization and consists of a thread id, a program counter, a register set and a stack. Threads belonging to the same process share the code section, the data section and open files. For example, a web browser can use one thread to render a page while another thread downloads images. Threads are cheaper to create and switch than processes because they share memory.

## CPU Scheduling

CPU scheduling is the method by which the operating system decides which ready process receives the CPU next. The scheduler tries to maximise CPU utilization and throughput while minimising waiting time, turnaround time and response time.

First-Come-First-Served scheduling runs processes in the order they arrive. FCFS is simple, but a long process at the front of the queue makes short processes wait, which is called the convoy effect. The waiting time of a process is the time it spends in the ready queue.

Shortest Job First scheduling picks the process with the smallest next CPU burst. SJF gives the minimum average waiting time for a given set of processes, but it is hard to implement because the next burst length is not known in advance.

Round Robin scheduling gives each process a small unit of CPU time called the time quantum. When the quantum expires the process is moved to the end of the ready queue. If the quantum is too large Round Robin behaves like FCFS, and if it is too small the overhead of context switching becomes high.

Priority scheduling assigns a priority to each process and runs the highest priority process first. A major problem is starvation, where low priority processes may wait forever. Aging solves starvation by gradually increasing the priority of waiting processes.

## Synchronization

A race condition occurs when several processes access and modify shared data at the same time and the result depends on the order of execution. The critical section is the part of the code where shared data is accessed. A correct solution to the critical section problem must provide mutual exclusion, progress and bounded waiting.

A mutex is a lock that provides mutual exclusion: only the thread holding the lock may enter the critical section. A semaphore is an integer variable that is accessed only through two atomic operations called wait and signal. A counting semaphore can take any non-negative value, while a binary semaphore takes only the values zero and one.

The producer-consumer problem uses a bounded buffer. The producer waits on the empty semaphore, locks the mutex, adds an item, unlocks the mutex and signals the full semaphore. The consumer does the reverse. The buffer is shared, so access to it must be protected.

## Deadlock

A deadlock is a situation in which a set of processes are blocked because each process holds a resource and waits for a resource held by another process. Deadlock can occur only if four conditions hold at the same time: mutual exclusion, hold and wait, no preemption and circular wait.

Deadlock can be prevented by breaking one of the four conditions. Deadlock can be avoided with the Banker's algorithm, which grants a request only if the resulting state is safe. A safe state is a state in which the system can allocate resources to every process in some order and still avoid deadlock. A resource allocation graph with a cycle indicates a possible deadlock.

## Memory Management

Memory management is the function of the operating system that keeps track of every memory location and allocates memory to processes. Paging is a memory management scheme that divides physical memory into fixed-size blocks called frames and divides logical memory into blocks of the same size called pages. Paging avoids external fragmentation. A logical address is split into a page number and a page offset. The page table maps each page number to a frame number.

The translation lookaside buffer, or TLB, is a small fast cache that stores recent page table entries. The effective access time is computed as: EAT = h * (t + m) + (1 - h) * (t + 2m), where h is the hit ratio, t is the TLB lookup time and m is the memory access time.

Virtual memory is a technique that allows the execution of processes that are not completely in memory. A page fault occurs when a process references a page that is not in memory. The operating system then loads the page from disk. Page replacement algorithms decide which page to remove when no free frame exists. FIFO replaces the oldest page, while LRU replaces the page that has not been used for the longest time. Belady's anomaly is the surprising situation in which giving FIFO more frames increases the number of page faults.

Thrashing is a condition in which a process spends more time paging than executing. Thrashing happens when the system does not have enough frames to hold the working set of its active processes.

## File Systems

A file system is the part of the operating system that organises, stores and retrieves data on storage devices. A file is a named collection of related information. The directory structure records the name and location of each file. An inode is a data structure that stores the attributes of a file and the disk block addresses of its data. Common allocation methods are contiguous, linked and indexed allocation.

Disk scheduling decides the order in which pending disk requests are served. FCFS disk scheduling serves requests in arrival order. SSTF serves the request closest to the current head position, which reduces seek time but may cause starvation. The SCAN algorithm moves the head in one direction serving requests until it reaches the end, then reverses.

## Interrupts and System Calls

An interrupt is a signal to the processor that an event needs immediate attention. When an interrupt occurs the CPU saves its state, runs an interrupt service routine and then resumes the interrupted program. A system call is the programmatic way in which a user program asks the kernel for a service. System calls switch the CPU from user mode to kernel mode. The kernel is the core of the operating system that manages the CPU, memory and devices.
