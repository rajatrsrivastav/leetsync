import type { Lesson, Resource, Role } from './types';

const all: Role[] = ['software', 'backend', 'fullstack', 'analyst'];
const engineering: Role[] = ['software', 'backend', 'fullstack'];
// These pages were opened and their relevant content checked on this date.
// Exercises and worked examples below are original; they are not company questions.
const resource = (title: string, url: string, publisher: string): Resource => ({
  title,
  url,
  publisher,
  verifiedAt: '2026-10-15',
  verification: 'verified',
});
const ostep = (title: string, chapter: string) =>
  resource(
    title,
    `https://pages.cs.wisc.edu/~remzi/OSTEP/${chapter}.pdf`,
    'OSTEP · University of Wisconsin–Madison',
  );
const postgres = (title: string, page: string) =>
  resource(title, `https://www.postgresql.org/docs/current/${page}.html`, 'PostgreSQL');

export const coreLessons: Lesson[] = [
  {
    id: 'os-processes-threads',
    subject: 'os',
    title: 'Processes, threads, and scheduling',
    summary:
      'Explain what is isolated, what is shared, and why a waiting task need not stop the machine.',
    minutes: 20,
    level: 'Foundation',
    prerequisites: [],
    roles: all,
    concept:
      'A process owns an execution environment; threads are execution paths within that environment.',
    explanation: [
      'A process normally has its own virtual address space. Threads in one process share that address space, including the heap, while each thread has its own execution state and stack. Separate processes can communicate through explicit mechanisms such as pipes or shared memory.',
      'A ready task can run; a blocked task is waiting for an event such as I/O. A scheduler selects ready work. Concurrency means work can make overlapping progress; parallelism means work executes simultaneously on multiple execution resources.',
      'A context switch saves and restores execution state. More threads do not guarantee more throughput: synchronization, scheduling overhead, memory contention, and a serial bottleneck can limit gains.',
    ],
    example:
      'A report service has one thread waiting for a database response and another formatting an already fetched report. On one CPU, formatting can progress while the query waits. On two CPUs, two formatting tasks may run in parallel. If both update a shared report counter, that update still needs coordination.',
    questions: [
      'Which values are shared between threads, and which belong to a particular execution path?',
      'Can a single-core machine execute concurrent tasks? Explain without saying they run simultaneously.',
      'When would process isolation be worth the cost of inter-process communication?',
    ],
    practice:
      'Draw a timeline for two requests, each with 3 ms CPU work, 8 ms I/O wait, and 2 ms CPU work. Compare serial handling with overlapping waits. State your assumptions about the I/O device and scheduler.',
    checkpoints: [
      'Distinguish concurrency from parallelism using a timeline.',
      'Name one isolation benefit of processes and one sharing risk of threads.',
      'Explain ready, running, and blocked states without relying on memorized definitions.',
    ],
    resources: [ostep('Concurrency: an introduction', 'threads-intro')],
    quiz: [
      {
        id: 'os-thread-sharing',
        prompt: 'Two threads in the same process ordinarily share which of these?',
        options: [
          'A single program counter',
          'The process address space',
          'One mandatory call stack',
          'The same current instruction',
        ],
        answer: 1,
        explanation:
          'Threads share the process address space, but maintain separate execution state and stacks.',
      },
    ],
  },
  {
    id: 'os-virtual-memory',
    subject: 'os',
    title: 'Virtual memory and address translation',
    summary:
      'Trace a virtual address to a physical frame and distinguish a translation miss from an invalid access.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: ['os-processes-threads'],
    roles: engineering,
    concept:
      'Virtual addresses let programs use an isolated address space whose layout need not match physical memory.',
    explanation: [
      'With paging, virtual memory is divided into pages and physical memory into frames. A page table records translations and access permissions. The page number is translated; the offset within the page is preserved.',
      'A translation lookaside buffer, or TLB, caches address translations. A TLB miss means the translation must be obtained elsewhere; it does not by itself mean data must be fetched from disk. A page fault requires OS handling, which can include allocating memory, reading data, or rejecting an invalid access.',
      'Virtual memory is an abstraction, not a promise of unlimited RAM. A large working set can create memory pressure. Locality matters because recently or nearby accessed data is more likely to be useful again.',
    ],
    example:
      'Assume 4 KiB pages. Virtual address 12,300 has virtual page number 3 and offset 12 because 12,300 = 3 × 4,096 + 12. If page 3 maps to frame 9, the physical address is 9 × 4,096 + 12 = 36,876. A different process may map its virtual page 3 to another frame.',
    questions: [
      'Why can two processes use the same virtual address without sharing its contents?',
      'Why is a TLB miss different from a page fault?',
      'What information besides a frame number belongs in a page-table entry?',
    ],
    practice:
      'Use 1 KiB pages and mappings 0→7, 1→3, 2→10. Translate virtual addresses 100, 1,025, and 2,500. Then mark page 2 read-only and explain how a write should be handled.',
    checkpoints: [
      'Compute page number and offset independently.',
      'Separate address translation, permissions, and physical data residency.',
      'Describe why poor locality can hurt performance.',
    ],
    resources: [
      ostep('The abstraction: address spaces', 'vm-intro'),
      ostep('Paging: introduction', 'vm-paging'),
    ],
    quiz: [
      {
        id: 'os-page-offset',
        prompt: 'With 4,096-byte pages, what is the offset of virtual address 8,209?',
        options: ['2', '17', '4,096', '8,192'],
        answer: 1,
        explanation:
          '8,209 = 2 × 4,096 + 17. Translation changes the page number, not this offset.',
      },
    ],
  },
  {
    id: 'os-concurrency',
    subject: 'os',
    title: 'Race conditions, locks, and deadlock',
    summary: 'Protect an invariant, identify a bad interleaving, and reason about lock ordering.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['os-processes-threads'],
    roles: engineering,
    concept: 'Synchronization protects shared invariants across operations that can interleave.',
    explanation: [
      'A read-modify-write operation is not automatically atomic. Two workers may read the same old value and overwrite each other. Identify the shared invariant and critical section before choosing a synchronization primitive.',
      'A mutex allows one participating worker to enter its protected section at a time. All accesses that need the protection must follow the same protocol. Keep the section small, but do not split an operation in a way that exposes invalid intermediate state.',
      'If one worker holds A while waiting for B and another holds B while waiting for A, neither can progress. A consistent lock-acquisition order prevents this particular cycle. Avoiding deadlock does not automatically guarantee fairness or high throughput.',
    ],
    example:
      'There is one remaining interview slot. Workers X and Y both read remaining = 1 before either writes, both reserve a slot, and both write remaining = 0. The final counter looks valid even though two reservations exist. Protect checking availability and reserving the slot as one operation; locking only the assignment is insufficient.',
    questions: [
      'What exactly is the invariant in a one-seat booking system?',
      'Why can a race occur on a single CPU?',
      'How can a program be free of deadlock but still starve a worker?',
    ],
    practice:
      'Write two interleaving tables for transferring a token between two accounts: one showing a lost update and one showing a lock-order deadlock. Revise the protocol and explain which failure each change prevents.',
    checkpoints: [
      'Show a concrete failing interleaving.',
      'Choose a critical section around an invariant, not merely a variable.',
      'Explain a global lock order and its limitations.',
    ],
    resources: [
      ostep('Locks', 'threads-locks'),
      ostep('Concurrency: an introduction', 'threads-intro'),
    ],
    quiz: [
      {
        id: 'os-lock-scope',
        prompt: 'To reserve the last seat safely, which section must be coordinated?',
        options: [
          'Only printing the confirmation',
          'Only reading the counter',
          'The availability check and reservation together',
          'Only writing the final counter',
        ],
        answer: 2,
        explanation:
          'Another worker must not be allowed to reserve between checking availability and recording the reservation.',
      },
    ],
  },
  {
    id: 'dbms-transactions',
    subject: 'dbms',
    title: 'Transactions, ACID, and isolation',
    summary:
      'Keep multi-step changes consistent and explain which concurrent observations are allowed.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: [],
    roles: all,
    concept:
      'A transaction groups operations into a unit of work; its isolation level constrains interaction with other transactions.',
    explanation: [
      'Atomicity means the transaction commits its changes together or does not commit them. Durability concerns committed data surviving failures under the database’s guarantees. Consistency depends on constraints and correct application logic; a transaction cannot automatically discover every business rule.',
      'Isolation controls what concurrent transactions can observe. PostgreSQL Read Committed uses a new snapshot for each statement, so two reads in one transaction can see different committed data. Serializable aims for an outcome equivalent to some serial execution and may require retrying a transaction.',
      'Use database constraints for rules such as unique reservation IDs. A successful transaction followed by a lost network response is an ambiguous outcome for the client; a stable request identifier helps make retries safe.',
    ],
    example:
      'A placement portal must insert a reservation and decrement available_slots together. If the second step fails, a rollback should remove the first. Two concurrent reservations also need a safe conditional update or appropriate locking; merely placing a read and write between BEGIN and COMMIT does not prove that overselling is impossible.',
    questions: [
      'What is the difference between atomicity and isolation?',
      'Why might a serializable transaction need a retry?',
      'How would you distinguish a failed transaction from a committed transaction whose response was lost?',
    ],
    practice:
      'Create a small reservations table with a unique request_id. Write a transaction for a booking and list failures before the write, before commit, and after commit. For each, describe what a client retry should do.',
    checkpoints: [
      'Explain ACID using one concrete multi-step operation.',
      'Name the isolation level when reasoning about a concurrent schedule.',
      'Treat retry safety as a separate requirement from atomicity.',
    ],
    resources: [
      postgres('Transactions', 'tutorial-transactions'),
      postgres('Transaction isolation', 'transaction-iso'),
    ],
    quiz: [
      {
        id: 'dbms-atomicity',
        prompt: 'What does transaction atomicity guarantee?',
        options: [
          'Every business rule is inferred automatically',
          'All changes commit together or none commit',
          'Concurrent readers always block',
          'Every transaction has constant execution time',
        ],
        answer: 1,
        explanation:
          'Atomicity concerns all-or-nothing commit behavior. Business rules, isolation, and performance are separate concerns.',
      },
    ],
  },
  {
    id: 'dbms-normalization',
    subject: 'dbms',
    title: 'Keys, dependencies, and normalization',
    summary: 'Replace update anomalies with a schema whose facts have clear owners.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: [],
    roles: all,
    concept:
      'Normalization organizes facts according to their dependencies, reducing avoidable duplication and anomalies.',
    explanation: [
      'Start with candidate keys and functional dependencies: if A determines B, every valid row with the same A must have the same B. A primary key is one selected candidate key; a foreign key links a fact to a referenced row.',
      'First normal form avoids repeating groups and uses values appropriate to each column’s domain. A prime attribute belongs to some candidate key. Second normal form requires first normal form and no non-prime attribute depending on a proper subset of any candidate key. For third normal form, every nontrivial dependency X→A must have X as a superkey or A as a prime attribute. In simple schemas this removes non-key facts depending on other non-key facts.',
      'Decomposition should preserve the intended relationships and permit correct reconstruction through joins. Denormalization can improve a measured workload, but creates an explicit responsibility to keep duplicated facts consistent.',
    ],
    example:
      'Enrollment(student_id, course_id, student_name, course_title, grade) has key (student_id, course_id). student_name depends only on student_id; course_title depends only on course_id. Split into Student, Course, and Enrollment(student_id, course_id, grade). Renaming a course now changes one owned fact instead of every enrollment.',
    questions: [
      'What makes a candidate key minimal?',
      'Which insertion, update, or deletion anomaly exists in the enrollment table?',
      'When would you deliberately duplicate a field, and how would you keep it consistent?',
    ],
    practice:
      'Model Student, Company, Application, and InterviewRound. State candidate keys and dependencies before drawing tables. Test whether deleting the last application accidentally removes the only stored company contact.',
    checkpoints: [
      'State dependencies before selecting tables.',
      'Explain a partial dependency with a composite key.',
      'Describe both the benefit and cost of a deliberate denormalization.',
    ],
    resources: [
      resource(
        'Normalization: dependencies, keys, and normal forms',
        'https://www.cs.rpi.edu/academics/courses/fall24/csci4380/fall2024/course_notes/normalization.html',
        'Rensselaer Polytechnic Institute · CSCI 4380',
      ),
    ],
    quiz: [
      {
        id: 'dbms-partial-key',
        prompt:
          'Enrollment has key (student_id, course_id), but student_name depends only on student_id. What does this demonstrate?',
        options: [
          'A partial dependency on the composite key',
          'A requirement for one table per column',
          'A missing transaction log',
          'A guarantee that all joins are slow',
        ],
        answer: 0,
        explanation:
          'The name depends on only part of the composite key. Moving student facts to Student avoids storing them for every enrollment.',
      },
    ],
  },
  {
    id: 'dbms-indexes',
    subject: 'dbms',
    title: 'Indexes and query-plan reasoning',
    summary: 'Choose an index from a query’s access pattern, then verify its actual effect.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['dbms-normalization'],
    roles: all,
    concept:
      'An index is an additional access structure with read benefits and storage/write costs.',
    explanation: [
      'An index can reduce the rows a query must inspect, but it must also be maintained when indexed values change. A table scan can be cheaper when a query needs much of the table or the table is small.',
      'Index column order, predicates, ordering requirements, and data distribution affect usefulness. Avoid assuming that adding an index makes every query fast. Examine the plan and estimated row counts instead of inferring execution from SQL text alone.',
      'EXPLAIN shows a chosen plan. EXPLAIN ANALYZE runs the statement and reports execution measurements, so use caution with writes and expensive queries. Compare representative workloads and account for caching and stale statistics.',
    ],
    example:
      'For applications filtered by student_id and ordered by applied_at, consider a composite index on (student_id, applied_at). Compare plans for one student with 8 applications and another with 80,000. The same schema can yield different costs because selectivity and returned data differ.',
    questions: [
      'Why might a sequential scan be the correct choice even when an index exists?',
      'What cost does an extra index add to inserts?',
      'How would a large difference between estimated and actual rows change your investigation?',
    ],
    practice:
      'On a disposable database, create applications(id, student_id, applied_at, status), load representative data, and compare EXPLAIN plans before and after one index. Record the query, row counts, plan, and tradeoff; do not run expensive experiments against production data.',
    checkpoints: [
      'Justify an index using a particular query.',
      'Explain a read/write tradeoff.',
      'Distinguish a plan estimate from a measured execution.',
    ],
    resources: [
      postgres('Introduction to indexes', 'indexes-intro'),
      postgres('Using EXPLAIN', 'using-explain'),
    ],
    quiz: [
      {
        id: 'dbms-explain',
        prompt: 'Which statement about EXPLAIN ANALYZE is correct?',
        options: [
          'It never executes the statement',
          'It executes the statement to collect actual measurements',
          'It guarantees the fastest possible query',
          'It creates missing indexes automatically',
        ],
        answer: 1,
        explanation:
          'EXPLAIN ANALYZE actually runs the statement. This matters especially for writes and costly queries.',
      },
    ],
  },
  {
    id: 'networks-dns',
    subject: 'networks',
    title: 'DNS and the path from name to address',
    summary:
      'Explain recursive resolution, authoritative answers, and why cached records can outlive a change.',
    minutes: 20,
    level: 'Foundation',
    prerequisites: [],
    roles: engineering,
    concept:
      'DNS is a distributed naming system, with delegated authority and caches that reduce repeated lookups.',
    explanation: [
      'A client commonly asks a recursive resolver for an answer. The resolver can use cached information or follow referrals through the DNS hierarchy to an authoritative server. The client is not required to contact every server itself.',
      'Records serve different purposes: A and AAAA associate names with IP addresses, while CNAME provides an alias. A name may have multiple answers, and an IP address need not correspond to only one website.',
      'TTL limits how long a record can be cached. Updating an authoritative answer does not instantly invalidate every cached old answer. Separate DNS lookup failures from transport failures and application errors when debugging.',
    ],
    example:
      'A portal changes its server address while a resolver still holds an old answer with 120 seconds of TTL remaining. Some students reach the old address until that cache entry expires. Refreshing the HTML does not necessarily force the resolver to fetch a fresh DNS answer.',
    questions: [
      'How does a recursive resolver differ from an authoritative name server?',
      'Why might two users temporarily resolve a name differently?',
      'What evidence would separate a DNS failure from an HTTP 500 response?',
    ],
    practice:
      'Run a DNS lookup for a public domain using your operating system’s lookup tool. Identify record type and TTL where available. Draw a cold-cache lookup and a warm-cache lookup, and label which parts are observed versus inferred.',
    checkpoints: [
      'Describe delegation without treating DNS as a single global database.',
      'Explain TTL and its deployment implication.',
      'Keep name resolution separate from the later HTTP exchange.',
    ],
    resources: [
      resource(
        'RFC 1034: Domain names — concepts and facilities',
        'https://www.rfc-editor.org/rfc/rfc1034.html',
        'RFC Editor / IETF',
      ),
    ],
    quiz: [
      {
        id: 'networks-dns-cache',
        prompt:
          'An authoritative DNS record changes. Why can a resolver still return the old value?',
        options: [
          'All DNS answers are permanent',
          'An existing cached record has not reached its TTL',
          'DNS resolves only once per computer lifetime',
          'HTTP always overwrites DNS',
        ],
        answer: 1,
        explanation:
          'A previously cached answer can remain usable until its TTL expires; authoritative changes do not instantly purge all caches.',
      },
    ],
  },
  {
    id: 'networks-tcp',
    subject: 'networks',
    title: 'TCP: a reliable byte stream',
    summary:
      'Reason about sequence numbers, acknowledgments, flow control, and application message boundaries.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: ['networks-dns'],
    roles: engineering,
    concept:
      'TCP provides an ordered byte stream between endpoints; the application still defines its messages and success semantics.',
    explanation: [
      'TCP uses sequence numbers, acknowledgments, and retransmission to recover from loss and deliver bytes in order while the connection remains viable. It does not preserve the boundaries between application write calls.',
      'The connection handshake establishes sequence-number state. Flow control prevents overwhelming the receiver’s advertised capacity. Congestion control addresses pressure on the network; these solve related but different problems.',
      'A TCP acknowledgment is not proof that an application completed a business operation. The receiver could acknowledge bytes and then crash before processing them. Applications need their own responses, timeouts, and retry rules.',
    ],
    example:
      'A sender writes "HELLO" and then "WORLD". A receiver may read "HELLOWORLD" once, or several smaller chunks. A protocol can frame messages with a length prefix, but must accumulate enough bytes to read both the prefix and the declared payload. One socket read is not automatically one complete message.',
    questions: [
      'Why does an application need framing on a TCP connection?',
      'How does receiver flow control differ from network congestion control?',
      'Why does transport reliability not guarantee exactly-once payment processing?',
    ],
    practice:
      'Design a length-prefixed chat message with a four-byte payload length. Walk through reads delivering 2 bytes, then 5 bytes, then the remainder. State the maximum allowed message size and what happens when the connection closes mid-message.',
    checkpoints: [
      'Explain a byte stream without inventing message boundaries.',
      'Separate delivery acknowledgment from application success.',
      'Describe why retries need application-level identifiers.',
    ],
    resources: [
      resource(
        'RFC 9293: Transmission Control Protocol',
        'https://www.rfc-editor.org/rfc/rfc9293.html',
        'RFC Editor / IETF',
      ),
    ],
    quiz: [
      {
        id: 'networks-tcp-stream',
        prompt: 'A program makes two TCP writes. What can the receiver assume?',
        options: [
          'It will receive exactly two reads',
          'Each read contains one complete business message',
          'Bytes are delivered in order, but write boundaries are not preserved',
          'The peer has committed all received data',
        ],
        answer: 2,
        explanation:
          'TCP provides a byte stream. Applications must define framing and application-level completion.',
      },
    ],
  },
  {
    id: 'networks-http',
    subject: 'networks',
    title: 'HTTP requests, responses, and retry semantics',
    summary:
      'Trace an HTTPS request and distinguish protocol state, authentication, and application state.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['networks-tcp'],
    roles: engineering,
    concept:
      'HTTP gives applications request and response semantics; transport, encryption, and stored application state are separate layers.',
    explanation: [
      'A request has a method, target, headers, and possibly a body; a response has a status, headers, and possibly a body. HTTP/1.1 and HTTP/2 commonly use TCP; HTTP/3 uses QUIC. HTTPS protects the connection using TLS-based security, not by hiding data from the endpoint receiving it.',
      'HTTP is stateless at the protocol level, but applications can associate requests through cookies or tokens. A cookie is a storage and transport mechanism, not automatically a secure authentication scheme.',
      'Retry decisions depend on method semantics and the operation. An idempotent operation has the same intended effect when repeated, even if responses differ. A timed-out creation request may already have succeeded; use an application request identifier where duplicate creation matters.',
    ],
    example:
      'POST /applications times out after the server stores an application. Blindly submitting again could create a duplicate. A stable idempotency key lets the server recognize the same logical request and return its existing outcome. GET /applications/42 can then retrieve the record without creating a new one.',
    questions: [
      'What happens between entering an HTTPS URL and receiving a response?',
      'Why is HTTP stateless even when a website remembers a login?',
      'Why is a timeout insufficient evidence that a server did not perform a write?',
    ],
    practice:
      'Inspect one request in browser developer tools. Identify method, status, content type, and cache headers without copying authentication cookies. Draw where DNS, transport establishment, TLS, and HTTP belong in the path.',
    checkpoints: [
      'Distinguish application state from protocol statelessness.',
      'Explain retry safety through intended effects.',
      'Avoid assuming every HTTP version runs over TCP.',
    ],
    resources: [
      resource(
        'Overview of HTTP',
        'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview',
        'MDN Web Docs',
      ),
      resource(
        'RFC 9114: HTTP/3',
        'https://www.rfc-editor.org/rfc/rfc9114.html',
        'RFC Editor / IETF',
      ),
    ],
    quiz: [
      {
        id: 'networks-http-timeout',
        prompt: 'A POST times out after sending its body. What can the client safely conclude?',
        options: [
          'The server definitely rolled back',
          'The operation definitely succeeded',
          'The outcome is uncertain and needs a safe recovery strategy',
          'Repeating the POST can never duplicate data',
        ],
        answer: 2,
        explanation:
          'The response may have been lost after the write committed. A status lookup or stable idempotency key can help resolve the uncertainty.',
      },
    ],
  },
  {
    id: 'oop-contracts',
    subject: 'oop',
    title: 'Objects, encapsulation, and substitutable contracts',
    summary:
      'Model behavior around invariants and decide when composition is clearer than inheritance.',
    minutes: 20,
    level: 'Foundation',
    prerequisites: [],
    roles: engineering,
    concept:
      'An object couples state with operations; a useful interface expresses behavior callers may rely on.',
    explanation: [
      'Encapsulation hides representation so operations can preserve invariants. Making a field private is only a mechanism; the design benefit comes from controlling valid state changes.',
      'Polymorphism lets callers use an interface implemented by different types. Inheritance can share behavior and express an appropriate subtype relationship, but a subtype must honor the expectations of its callers.',
      'Composition delegates responsibilities to collaborators. Prefer it when behavior varies independently or an inheritance relationship would force operations that do not make sense for some subclasses.',
    ],
    example:
      'An InterviewSlot exposes reserve(studentId) and cancel(reservationId), while hiding its reservation map. Returning the mutable map would let callers bypass capacity checks. A NotificationSender interface can have email and in-memory test implementations without making InterviewSlot inherit from either sender.',
    questions: [
      'What invariant does your class protect that a public record would not?',
      'When does a subtype violate the promise of its parent interface?',
      'Why is dependency injection useful even without a framework?',
    ],
    practice:
      'Design a bounded StudyQueue with add, remove, and list operations. Specify empty and full behavior. Then add a notification collaborator without exposing the internal array or creating a subclass for every notification channel.',
    checkpoints: [
      'State an invariant and the operation that preserves it.',
      'Explain composition with a concrete collaborator.',
      'Describe an interface in terms of caller expectations.',
    ],
    resources: [
      resource(
        'Object-oriented programming concepts',
        'https://docs.oracle.com/javase/tutorial/java/concepts/',
        'Oracle Java Tutorials',
      ),
    ],
    quiz: [
      {
        id: 'oop-encapsulation',
        prompt: 'Which design best protects a queue’s capacity invariant?',
        options: [
          'Expose its mutable internal array',
          'Let every caller change the capacity counter directly',
          'Provide operations that validate changes and return a safe view',
          'Replace all methods with public fields',
        ],
        answer: 2,
        explanation:
          'Controlled operations keep the representation private and can reject invalid state transitions.',
      },
    ],
  },
  {
    id: 'oop-solid-patterns',
    subject: 'oop',
    title: 'SOLID tradeoffs and the Strategy pattern',
    summary:
      'Use interfaces to separate decisions that change independently, without adding unnecessary abstractions.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['oop-contracts'],
    roles: engineering,
    concept:
      'Design principles guide change boundaries; patterns are named options, not mandatory layers.',
    explanation: [
      'Single responsibility asks whether a component has unrelated reasons to change. Open/closed suggests adding a behavior through a stable extension point when that variation is real. Liskov substitution asks whether implementations preserve their interface’s behavioral promises.',
      'Interface segregation avoids making callers depend on operations they do not use. Dependency inversion places high-level policy behind suitable abstractions rather than binding it directly to a particular external implementation.',
      'Strategy represents interchangeable behavior behind one contract. A comparator is a practical example: sorting can accept different ordering rules. An abstraction earns its place by simplifying a real change or test; creating one for every line of code can make the program harder to understand.',
    ],
    example:
      'A preparation planner ranks tasks using a PriorityPolicy. An overdue-first policy and a deadline-first policy share score(task, context). The planner controls selection and budgeting; the policy controls ranking. Tests can supply a predictable policy. Neither policy should secretly modify the task list, because callers expect scoring behavior.',
    questions: [
      'Which change would justify separating ranking policy from planning?',
      'How could a Strategy implementation violate its contract?',
      'When would a simple function be better than a hierarchy of strategy classes?',
    ],
    practice:
      'Sketch a NotificationService that accepts a delivery interface. Add a fake sender for tests and a retry decorator. Identify where single responsibility and dependency inversion help, then identify one abstraction you deliberately did not introduce.',
    checkpoints: [
      'Explain each SOLID principle through a behavior or change.',
      'Provide a concrete Strategy example.',
      'Defend a tradeoff instead of treating principles as absolute rules.',
    ],
    resources: [
      resource(
        'Architectural principles',
        'https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles',
        'Microsoft Learn',
      ),
      resource(
        'Comparator interface',
        'https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Comparator.html',
        'Oracle Java API',
      ),
    ],
    quiz: [
      {
        id: 'oop-strategy',
        prompt:
          'A sorter receives a comparator to switch between deadline and title ordering. What is being separated?',
        options: [
          'The ordering policy from the sorting operation',
          'The database from all network traffic',
          'The application from every possible change',
          'The class from its type system',
        ],
        answer: 0,
        explanation:
          'The comparator supplies a replaceable ordering rule while the sort mechanism remains reusable.',
      },
    ],
  },
  {
    id: 'sql-joins',
    subject: 'sql',
    title: 'SQL joins, cardinality, and missing rows',
    summary: 'Predict result rows before writing a join and keep optional relationships optional.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: ['dbms-normalization'],
    roles: all,
    concept: 'A join combines matching rows; one-to-many matches can multiply output rows.',
    explanation: [
      'An inner join returns matching pairs. A left join also retains unmatched left rows, filling the right-side columns with NULL. If one student has three applications, joining students to applications produces three rows for that student.',
      'Choose join keys from the relationship, not merely matching column names. A missing join condition can produce a Cartesian product. DISTINCT can hide a mistaken relationship without fixing the underlying query.',
      'The ON clause determines matches. A later WHERE condition can discard the NULL-extended rows of a left join. When you need every student and only shortlisted applications, put the application restriction in the join condition.',
    ],
    example:
      "SELECT s.id, a.id AS application_id FROM students s LEFT JOIN applications a ON a.student_id = s.id AND a.status = 'shortlisted';\nIf Asha has two shortlisted applications and Ravi has none, the result contains two Asha rows and one Ravi row with a NULL application_id. Moving a.status = 'shortlisted' into WHERE would remove Ravi.",
    questions: [
      'How many rows should this join return for a student with two applications?',
      'Why can a WHERE condition make a left join behave like an inner join?',
      'When would EXISTS communicate the intent better than joining and deduplicating?',
    ],
    practice:
      'Use students (1,Asha),(2,Ravi),(3,Meera) and applications (10,1),(11,1),(12,3). Write inner and left joins, then list students with no application. Predict every output row before running the queries in your SQL environment.',
    checkpoints: [
      'Predict join cardinality from a tiny dataset.',
      'Keep unmatched rows when the requirement asks for them.',
      'Recognize why accidental duplicates need investigation.',
    ],
    resources: [postgres('Joins between tables', 'tutorial-join')],
    quiz: [
      {
        id: 'sql-left-cardinality',
        prompt:
          'Three students have 2, 0, and 1 matching applications. How many rows does students LEFT JOIN applications return?',
        options: ['2', '3', '4', '6'],
        answer: 2,
        explanation:
          'The student with two matches contributes two rows, the unmatched student contributes one NULL-extended row, and the last contributes one: 4 total.',
      },
    ],
  },
  {
    id: 'sql-aggregation',
    subject: 'sql',
    title: 'Grouping, aggregates, and NULL',
    summary: 'Choose the result grain and place filters before or after aggregation deliberately.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['sql-joins'],
    roles: all,
    concept:
      'Aggregation reduces rows into groups; every selected non-aggregate value must be valid for the group under the database’s rules.',
    explanation: [
      'State the result grain first: one row per student, company, or month. GROUP BY forms those groups; aggregates summarize each group. WHERE filters input rows before grouping, while HAVING filters groups after aggregates are computed.',
      'COUNT(*) counts rows. COUNT(column) counts non-NULL values. After a left join, an unmatched parent still produces a row, so COUNT(*) may incorrectly report one child; counting a non-nullable child key expresses the intended count.',
      'Joining multiple one-to-many relationships before aggregation can multiply rows and inflate totals. Aggregate each child relation to the intended grain first, or otherwise prove that duplication cannot affect the result.',
    ],
    example:
      'SELECT s.id, COUNT(a.id) AS applications FROM students s LEFT JOIN applications a ON a.student_id = s.id GROUP BY s.id;\nRavi, who has no applications, receives count 0. COUNT(*) would return 1 for his NULL-extended row. Add HAVING COUNT(a.id) >= 2 to keep only students with at least two applications.',
    questions: [
      'What is the output grain of your query?',
      'Why does COUNT(*) differ from COUNT(a.id) after a left join?',
      'How can joining applications and interview rounds inflate a sum?',
    ],
    practice:
      'For applications(id, company_id, status), return companies with at least three shortlisted applications. Explain why the status filter belongs in WHERE and the count condition in HAVING. Then adapt the query to include companies with zero shortlisted applications.',
    checkpoints: [
      'State the group grain before writing SELECT.',
      'Explain NULL-sensitive counting.',
      'Separate row filtering from group filtering.',
    ],
    resources: [postgres('Aggregate functions', 'tutorial-agg')],
    quiz: [
      {
        id: 'sql-count-null',
        prompt:
          'A left join produces one row with a NULL child_id for a parent with no children. What is COUNT(child_id) for that parent?',
        options: ['0', '1', 'NULL', 'It must raise an error'],
        answer: 0,
        explanation:
          'COUNT(expression) skips NULL values. COUNT(*) would count the NULL-extended row instead.',
      },
    ],
  },
  {
    id: 'sql-window-functions',
    subject: 'sql',
    title: 'Window functions and top-per-group queries',
    summary: 'Add group context without collapsing rows, and make tie behavior explicit.',
    minutes: 30,
    level: 'Interview',
    prerequisites: ['sql-aggregation'],
    roles: all,
    concept:
      'A window function computes over related rows while preserving each output row’s identity.',
    explanation: [
      'PARTITION BY divides rows into related sets; ORDER BY inside OVER specifies their analytical ordering. Unlike GROUP BY aggregation, a window function can keep each application row while adding its rank or a group total.',
      'ROW_NUMBER assigns a sequence, RANK leaves gaps after ties, and DENSE_RANK does not leave those gaps. If you need one deterministic row among equal scores, specify a stable tie-breaker such as id.',
      'Window frames matter for running aggregates. Explicit ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW expresses a row-by-row running total. Filter a computed rank in an outer query or CTE rather than assuming it is available in WHERE at the same query level.',
    ],
    example:
      'WITH ranked AS (SELECT id, company_id, score, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY score DESC, id ASC) AS rn FROM applications) SELECT id, company_id, score FROM ranked WHERE rn <= 2;\nThis chooses at most two rows per company, resolving equal scores by id. Use a ranking function with a different tie policy if the requirement is to include everyone tied at a score boundary.',
    questions: [
      'When does GROUP BY lose information a window query should preserve?',
      'How do ROW_NUMBER, RANK, and DENSE_RANK behave on scores 90, 90, 80?',
      'What makes top-per-group results deterministic?',
    ],
    practice:
      'Create two companies with application scores including ties. Write top-two-row and top-two-distinct-score queries, and explain their different outputs. Add a running application count with an explicit frame and ordering.',
    checkpoints: [
      'Choose ranking semantics from the requirement.',
      'Provide a stable ordering for deterministic selection.',
      'Explain partition, ordering, and frame separately.',
    ],
    resources: [postgres('Window functions', 'tutorial-window')],
    quiz: [
      {
        id: 'sql-dense-rank',
        prompt: 'Scores are 90, 90, 80 in descending order. Which values does DENSE_RANK assign?',
        options: ['1, 2, 3', '1, 1, 3', '1, 1, 2', '0, 0, 1'],
        answer: 2,
        explanation:
          'Tied values share a rank, and DENSE_RANK does not leave a gap before the next distinct value.',
      },
    ],
  },
  {
    id: 'system-hld',
    subject: 'system',
    title: 'HLD: requirements, estimates, and a URL shortener',
    summary:
      'Turn an ambiguous design prompt into measurable requirements and a defensible initial architecture.',
    minutes: 30,
    level: 'Foundation',
    prerequisites: ['networks-http', 'dbms-indexes'],
    roles: engineering,
    concept:
      'High-level design connects a workload and its failure requirements to component and data-flow choices.',
    explanation: [
      'Clarify users, operations, scale, retention, latency, and correctness requirements before drawing infrastructure. Separate functional requirements, such as creating a short URL, from quality goals, such as redirect latency or availability.',
      'Estimate load with visible units and assumptions. Average requests per second is not peak load. Storage estimates need payload size, retention, indexes, and replication assumptions. These are planning estimates, not benchmark results.',
      'Begin with a simple service and authoritative data store. Identify the measured or anticipated bottleneck before adding caches, replicas, queues, or sharding. Scaling adds failure modes as well as capacity; explain how the system detects and recovers from failures.',
    ],
    example:
      'Original practice scenario: design a URL shortener with 100,000 new links/day and 5 million redirects/day. Average redirect traffic is about 58 requests/second; a stated 10× peak assumption yields about 580. Start with create and redirect APIs plus a unique code→URL mapping. Discuss collision handling, expired links, and abuse before adding distributed components.',
    questions: [
      'Which requirement would change your database or consistency choice?',
      'Where did your peak multiplier come from?',
      'What is the smallest architecture that meets the stated goals, and how would you know it no longer does?',
    ],
    practice:
      'Spend 5 minutes clarifying the shortener requirements, 5 estimating traffic/storage, 10 drawing request and write paths, and 10 walking through one failure. Label assumptions and list what you would measure before scaling. This is an original exercise, not a claimed company interview question.',
    checkpoints: [
      'State requirements before components.',
      'Attach units and assumptions to every estimate.',
      'Trace one successful request and one component failure.',
    ],
    resources: [
      resource(
        'Reliability design principles',
        'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-principles.html',
        'AWS Well-Architected',
      ),
    ],
    quiz: [
      {
        id: 'system-average-load',
        prompt: 'A service receives 864,000 requests per day. What is its average requests/second?',
        options: ['1', '10', '100', '1,000'],
        answer: 1,
        explanation:
          'There are 86,400 seconds in a day; 864,000 ÷ 86,400 = 10. Peak load needs a separate assumption or measurement.',
      },
    ],
  },
  {
    id: 'system-caching',
    subject: 'system',
    title: 'Caching, freshness, and invalidation',
    summary: 'Design cache reads and writes around acceptable staleness and failure behavior.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['system-hld'],
    roles: engineering,
    concept:
      'A cache keeps reusable data closer to readers, trading extra state and possible staleness for lower repeated work.',
    explanation: [
      'In cache-aside, a reader checks the cache, fetches a miss from the authoritative store, and populates the cache. The application is responsible for keeping cached data appropriately fresh when writes occur.',
      'TTL limits retention but does not guarantee the latest value. Choose acceptable staleness by use case: an old public description may be tolerable while a stale seat count must not authorize an oversell. Enforce correctness against authoritative state.',
      'Consider key design, tenant boundaries, eviction, concurrent misses, and cache outages. A popular expired key can cause many simultaneous database reads. Request coalescing, staggered expirations, or prewarming can help, but add implementation complexity.',
    ],
    example:
      'Cache a company’s public profile under company:<id>:profile for five minutes. After a committed edit, invalidate that key. Describe a race where a concurrent reader fetched the old value before the edit and fills the cache afterward. A TTL bounds that particular stale entry’s lifetime but does not eliminate the race.',
    questions: [
      'What is the authoritative source when the cache disagrees?',
      'How stale can this value be before it harms users?',
      'What happens to database load when the cache is unavailable?',
    ],
    practice:
      'Draw the read-miss and update paths for the company profile. Simulate an update racing with a cache fill, then a cache outage. Pick a freshness policy and explain why the same policy would or would not suit interview-seat availability.',
    checkpoints: [
      'Name the source of truth.',
      'Trace a stale-cache race.',
      'Specify cache failure behavior and acceptable staleness.',
    ],
    resources: [
      resource(
        'Cache-aside pattern',
        'https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside',
        'Microsoft Learn',
      ),
    ],
    quiz: [
      {
        id: 'system-cache-ttl',
        prompt: 'What does a five-minute cache TTL guarantee by itself?',
        options: [
          'Every read is current',
          'The database can never fail',
          'A cache entry expires according to that lifetime policy',
          'Concurrent writes cannot race',
        ],
        answer: 2,
        explanation:
          'TTL controls expiration. It does not make cached data instantly consistent with writes or resolve concurrent fill races.',
      },
    ],
  },
  {
    id: 'system-load-balancing',
    subject: 'system',
    title: 'Load balancing, stateless services, and failure recovery',
    summary:
      'Scale a request path and explain what happens when an instance becomes slow or unavailable.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['system-hld'],
    roles: engineering,
    concept:
      'A load balancer distributes work among targets; a resilient service must also manage state and failure semantics.',
    explanation: [
      'Load balancers route traffic to registered targets and use health information to decide where to send work. Network-level and application-level routing expose different capabilities. A health check is an observation, not proof that every request will succeed.',
      'Keeping request-serving instances stateless makes replacement and horizontal scaling easier. Durable data and shared session state need an appropriate store. Sticky routing may support a requirement, but can produce imbalance and does not make an instance’s memory durable.',
      'Timeouts, bounded retries, and safe operation identifiers belong in the design. Retrying every failed request immediately can increase load during an outage. Capacity planning should consider losing an instance or failure zone, not just steady-state throughput.',
    ],
    example:
      'Three API instances serve a placement portal. If one dies, new traffic can move to healthy targets, but an in-flight booking may have committed before its response was lost. A durable request ID lets another instance recover the result. A session held only in the dead instance’s memory cannot be recovered merely by rerouting traffic.',
    questions: [
      'What does a health endpoint prove, and what does it miss?',
      'How does storing login sessions in instance memory affect scale-out?',
      'When could a retry amplify an outage or duplicate a business action?',
    ],
    practice:
      'Draw client→load balancer→three API instances→database. Remove one instance and trace a read, an in-flight write, and a session lookup. Set a retry budget and describe how you would measure successful recovery.',
    checkpoints: [
      'Locate all durable and per-instance state.',
      'Distinguish traffic rerouting from recovery of an operation.',
      'Explain a failure case involving timeouts and retries.',
    ],
    resources: [
      resource(
        'How Elastic Load Balancing works',
        'https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html',
        'AWS Documentation',
      ),
    ],
    quiz: [
      {
        id: 'system-stateless',
        prompt: 'Why does stateless request handling help horizontal scaling?',
        options: [
          'It removes the need for any data store',
          'Requests can move between instances without relying on one instance’s local session memory',
          'It guarantees zero latency',
          'It prevents all database contention',
        ],
        answer: 1,
        explanation:
          'Instances become easier to replace or add because requests do not depend on durable state stored only in a particular instance’s memory.',
      },
    ],
  },
  {
    id: 'system-lld-booking',
    subject: 'system',
    title: 'LLD: a meeting-room booking service',
    summary:
      'Specify contracts, interval rules, and concurrency behavior before choosing classes and patterns.',
    minutes: 30,
    level: 'Interview',
    prerequisites: ['oop-solid-patterns', 'dbms-transactions'],
    roles: engineering,
    concept:
      'Low-level design turns requirements into explicit types, operations, invariants, and testable contracts.',
    explanation: [
      'Begin with the domain: Room, TimeRange, Reservation, and a booking service. State whether time ranges are half-open, which time representation is used, and whether a user can hold multiple overlapping reservations.',
      'Separate deciding whether a reservation is valid from sending a notification. A repository interface can support both durable storage and test doubles. Use a pattern only when it handles a real variation, such as different allocation policies.',
      'A correct in-memory check is insufficient under concurrent requests. The check and reservation must be enforced together by the chosen storage or synchronization mechanism. Define idempotency, cancellation, authorization, and errors in the operation contract.',
    ],
    example:
      'Original practice scenario: reserve(roomId, start, end, requestId). Using half-open intervals [start,end), a 10:00–10:30 booking does not overlap 10:30–11:00. Two ranges overlap when startA < endB and startB < endA. Repeating the same requestId should return the existing reservation, while reusing that ID with different input should be rejected.',
    questions: [
      'Which invariant must hold across concurrent callers?',
      'What should cancel do if called twice?',
      'Where would you substitute a test double, and which contract must it preserve?',
    ],
    practice:
      'Write the booking and cancellation interfaces, an error model, and six test cases: adjacency, overlap, invalid interval, duplicate request, unauthorized cancellation, and two simultaneous requests. Explain how your persistence choice enforces the no-overlap rule. This is an original practice design, not an attributed company question.',
    checkpoints: [
      'Define interval boundaries and duplicate-request semantics.',
      'Separate business rules from notification delivery.',
      'Test the invariant under concurrent requests, not only sequential calls.',
    ],
    resources: [
      resource(
        'Architectural principles',
        'https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles',
        'Microsoft Learn',
      ),
      postgres('Transactions', 'tutorial-transactions'),
    ],
    quiz: [
      {
        id: 'system-booking-adjacent',
        prompt: 'With half-open intervals, does [10:00,10:30) overlap [10:30,11:00)?',
        options: [
          'Yes, all adjacent ranges overlap',
          'No, the first range excludes its ending instant',
          'Only if the room has a cache',
          'It cannot be specified by the API',
        ],
        answer: 1,
        explanation:
          'The endpoint 10:30 belongs to the second interval, not the first. Explicit interval semantics remove this ambiguity.',
      },
    ],
  },
];
