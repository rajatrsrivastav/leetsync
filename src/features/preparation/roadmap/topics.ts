import type { RoadmapTopic, RoadmapTrack } from './types';
const cs = 'https://github.com/kratos0718/core-cs-interview-prep/blob/main/';
const primer = 'https://github.com/donnemartin/system-design-primer#';
const lld = 'https://github.com/ashishps1/awesome-low-level-design/blob/main/problems/';
const handbook = 'https://www.techinterviewhandbook.org/';
const source = (file: string, section: string) => `${cs}${file}/questions.md#${section}`;
const os = (section: string) => source('04_os', section);
const db = (section: string) => source('03_dbms', section);
const cn = (section: string) => source('05_networks', section);
const oop = (section: string) => source('02_oop', section);
const sql = (section: string) => source('06_dbms_sql', section);
type Row = [title: string, learn: string, prompt: string, practice: string, kind?: RoadmapTopic['practice']['kind']];
// Prompts are scoped practice instructions, not copied answers or claims about company frequency.
const rows: Record<RoadmapTrack, Row[]> = {
  os: [
    ['Processes and threads', os('a-basics--processes'), 'Contrast a process with a thread. Explain what two threads share and sketch a race on a shared counter before checking the source questions.', os('a-basics--processes')],
    ['CPU scheduling', os('b-scheduling'), 'Trace three short jobs under FCFS and round-robin. Compare waiting time and explain when preemption matters; use the linked scheduling questions to check your reasoning.', os('b-scheduling')],
    ['Synchronization and deadlocks', os('c-synchronization--deadlock-very-high-frequency'), 'Draw a two-lock deadlock, identify its necessary conditions, and propose a prevention rule. Answer the related deadlock questions aloud.', os('c-synchronization--deadlock-very-high-frequency')],
    ['Virtual memory and paging', os('d-memory-management'), 'Trace address translation with a TLB miss and then a page fault. Explain why the two events differ, using the linked memory-management questions.', os('d-memory-management')],
    ['File systems and I/O tradeoffs', os('e-file-systems--io'), 'Follow a file read from an application to storage. Explain buffering versus caching and discuss one durability/performance tradeoff from the linked I/O questions.', os('e-file-systems--io')],
  ],
  dbms: [
    ['Relational keys and constraints', db('a-fundamentals'), 'Model students, courses, and enrolments. Identify primary, candidate, and foreign keys, then explain which invalid rows the constraints reject.', db('a-fundamentals')],
    ['SQL joins', sql('c-joins-very-high-frequency'), 'Solve HackerRank African Cities using the supplied CITY and COUNTRY schema. Explain the join condition and what an unmatched row would do.', 'https://www.hackerrank.com/challenges/african-cities/problem', 'Code'],
    ['Database indexing', db('d-indexing--storage-high-frequency'), 'Choose an index for a lookup by customer and creation date. Explain column order, write overhead, and why an index might not help a broad scan.', db('d-indexing--storage-high-frequency')],
    ['Transactions and isolation', db('c-transactions-acid-concurrency-high-frequency'), 'Trace two concurrent withdrawals. Explain the anomaly, the isolation needed, and how ACID affects the outcome before consulting the transaction questions.', db('c-transactions-acid-concurrency-high-frequency')],
    ['SQL ranking and ties', sql('e-window-functions-ctes-and-modern-sql'), 'Solve LeetCode Rank Scores. Test ties and gaps, and explain why the chosen ranking function matches the expected output.', 'https://leetcode.com/problems/rank-scores/', 'Code'],
  ],
  cn: [
    ['Network layers and encapsulation', cn('a-fundamentals--models'), 'Trace a web request through TCP/IP layers. Assign addressing and reliability to the correct layer and compare the model with OSI.', cn('a-fundamentals--models')],
    ['TCP versus UDP', cn('b-transport-layer-tcpudp-very-high-frequency'), 'Compare TCP and UDP for a file download and a live voice call. Explain ordering, loss handling, and connection setup using the transport questions.', cn('b-transport-layer-tcpudp-very-high-frequency')],
    ['DNS and HTTP request lifecycle', cn('d-application-layer--web-high-frequency'), 'Explain the path from entering a URL to receiving an HTTP response, including DNS caching, transport setup, and status codes.', cn('d-application-layer--web-high-frequency')],
    ['TLS and network security', cn('f-security--advanced'), 'Explain which threats HTTPS addresses and which it does not. Walk through certificate verification and contrast encryption with authentication.', cn('f-security--advanced')],
    ['IP routing and subnetting', cn('c-network-layer--ip'), 'Work a small subnet example, distinguish a switch from a router, and trace how a packet leaves its local network.', cn('c-network-layer--ip')],
  ],
  oop: [
    ['Encapsulation and abstraction', oop('a-core-concepts--the-4-pillars'), 'Model a bank account with a public API and protected invariants. Explain how encapsulation differs from abstraction without relying on memorized definitions.', oop('a-core-concepts--the-4-pillars')],
    ['Inheritance versus composition', oop('b-inheritance-deep-dive'), 'Compare extending a vehicle hierarchy with composing interchangeable engines. Explain when an is-a relationship is invalid.', oop('b-inheritance-deep-dive')],
    ['Interfaces and polymorphism', oop('a-core-concepts--the-4-pillars'), 'Implement a tiny notification interface with email and SMS implementations. Show a client that uses either without inspecting its concrete type.', oop('a-core-concepts--the-4-pillars'), 'Code'],
    ['SOLID and dependency boundaries', oop('d-advanced--design'), 'Refactor a checkout service that constructs its own payment provider. Explain the changed dependency boundary and how to test it with a fake provider.', oop('d-advanced--design'), 'Code'],
    ['Equality, copying, and object lifetime', oop('e-language-mechanics--gotchas'), 'Demonstrate shallow versus deep copying in your language. Explain equality and hashing contracts and one bug a mutable map key can cause.', oop('e-language-mechanics--gotchas'), 'Code'],
  ],
  hld: [
    ['Capacity estimates and design requirements', primer+'back-of-the-envelope-calculations', 'Start the URL shortener exercise: clarify requirements, estimate requests and storage, and sketch the API. Scope today to requirements and estimates.', primer+'design-pastebincom-or-bitly', 'Design'],
    ['Load balancing', 'https://blog.algomaster.io/p/load-balancing-algorithms-explained-with-code', 'Design the request distribution layer for three API servers. Compare two balancing policies, add health checks, and explain how a failed server leaves rotation.', primer+'load-balancer', 'Design'],
    ['Caching and invalidation', primer+'cache', 'Design a cache for the URL shortener read path. Specify expiry, a stale-data case, and what happens when the cache is unavailable.', primer+'design-pastebincom-or-bitly', 'Design'],
    ['Design a URL Shortener', primer+'how-to-approach-a-system-design-interview-question', 'Extend your earlier sketch into a URL shortener: show the data model, key generation, redirect path, and one scaling bottleneck. Attempt before opening sample solutions.', primer+'design-pastebincom-or-bitly', 'Design'],
    ['Design a web crawler', primer+'asynchronism', 'Design a small crawler: frontier, duplicate detection, rate limits, and worker failure recovery. Spend this session on the queue and retry boundaries.', primer+'design-a-web-crawler', 'Design'],
  ],
  lld: [
    ['Parking Lot: model and allocation', lld+'parking-lot.md#requirements', 'Read only the requirements, then implement a small parking lot slice: allocate and release a compatible spot. Include full-capacity and double-release tests.', lld+'parking-lot.md#requirements', 'Code'],
    ['Vending Machine: state transitions', lld+'vending-machine.md#requirements', 'Implement a minimal selection/payment/dispense flow. Test insufficient money and unavailable stock before inspecting reference implementations.', lld+'vending-machine.md#requirements', 'Code'],
    ['Tic Tac Toe: rules and interfaces', lld+'tic-tac-toe.md#requirements', 'Implement move validation and win/draw detection behind a game interface. Cover repeated moves and attempts after the game ends.', lld+'tic-tac-toe.md#requirements', 'Code'],
    ['LRU Cache: API and eviction', lld+'lru-cache.md#requirements', 'Implement the required cache API and eviction behavior. Test updating existing keys and a capacity-one cache; inspect reference code only after your attempt.', lld+'lru-cache.md#requirements', 'Code'],
    ['Pub/Sub: delivery and concurrency', lld+'pub-sub-system.md#requirements', 'Implement a minimal publisher/subscriber slice. Specify unsubscribe behavior and add a test for a slow subscriber; discuss synchronization boundaries.', lld+'pub-sub-system.md#requirements', 'Code'],
  ],
  aptitude: [
    ['Percentages and changing bases', 'https://www.indiabix.com/aptitude/percentage/', 'Attempt the first three percentage questions without opening explanations. Record the result and explain the denominator in each calculation.', 'https://www.indiabix.com/aptitude/percentage/', 'Practice'],
    ['Ratios and proportions', 'https://www.indiabix.com/aptitude/ratio-and-proportion/', 'Attempt three ratio-and-proportion questions. Recheck units and explain how the ratio changes when the total changes.', 'https://www.indiabix.com/aptitude/ratio-and-proportion/', 'Practice'],
    ['Time and work', 'https://www.indiabix.com/aptitude/time-and-work/', 'Attempt three time-and-work questions in a 15-minute practice block. Explain your rate model before checking any worked solution.', 'https://www.indiabix.com/aptitude/time-and-work/', 'Practice'],
    ['Permutations and combinations', 'https://www.indiabix.com/aptitude/permutation-and-combination/', 'Attempt three counting questions. State whether order matters and identify any overcounting before checking the source explanation.', 'https://www.indiabix.com/aptitude/permutation-and-combination/', 'Practice'],
    ['Probability and conditional reasoning', 'https://www.indiabix.com/aptitude/probability/', 'Attempt three probability questions. List the sample space or conditioning event and check that your answer stays within valid bounds.', 'https://www.indiabix.com/aptitude/probability/', 'Practice'],
  ],
  interviews: [
    ['A concise self introduction', handbook+'self-introduction/', 'Record a 90-second introduction grounded in your actual projects and interests. Listen back and remove claims you cannot support.', handbook+'self-introduction/', 'Practice'],
    ['Explain a project you built', handbook+'behavioral-interview/#3-prepare-answers-to-the-big-three-questions', 'Choose a real project and explain your individual contribution, a technical decision, an alternative, and the evidence for the result.', handbook+'behavioral-interview-questions/', 'Practice'],
    ['Behavioral stories with STAR', handbook+'behavioral-interview/#1-learn-the-star-answer-format', 'Choose a conflict or setback question from the source list. Answer using a real experience, then check whether your actions and learning are specific.', handbook+'behavioral-interview-questions/', 'Practice'],
    ['Resume claims under follow-up', handbook+'resume/', 'Select one project claim from your resume. Defend the measurement, explain a failure case, and identify what you personally implemented.', handbook+'behavioral-interview-questions/', 'Practice'],
    ['A timed mock and self-review', handbook+'behavioral-interview-rubrics/', 'Run a 20-minute mock with three source questions, alone or with a partner. Record which follow-ups exposed gaps and one concrete improvement.', handbook+'behavioral-interview-questions/', 'Practice'],
  ],
};
const resourceIds: Record<RoadmapTrack, string> = { os: 'core-cs-questions', dbms: 'core-cs-questions', cn: 'core-cs-questions', oop: 'core-cs-questions', hld: 'hld-primary', lld: 'lld', aptitude: 'aptitude', interviews: 'interviews' };
const tracks = Object.keys(rows) as RoadmapTrack[];
export const roadmapTopics: RoadmapTopic[] = Array.from({ length: 5 }, (_, stage) => tracks.map(track => {
  const [title, learn, prompt, practice, kind = 'Explain'] = rows[track][stage]!;
  return { id: `${track}-${stage+1}`, track, title, level: stage < 2 ? 'Foundation' : stage < 4 ? 'Intermediate' : 'Advanced', minutes: stage === 0 ? 20 : stage === 4 ? 30 : 25, prerequisites: stage ? [`${track}-${stage}`] : [], resourceId: resourceIds[track], learn: { label: 'Study the topic at the source', url: learn }, practice: { prompt, url: practice, kind, note: ['Code','Design','Practice'].includes(kind) ? 'Some sources include solutions or explanations. Attempt the brief first; opening a link does not record completion. Platform accounts may be required.' : 'Use the linked topic questions as a self-check after explaining independently; the source also contains answers.' }, verifiedAt: '2026-10-17' };
})).flat();
export const roadmapTopicById = (id: string) => roadmapTopics.find(t => t.id === id);
