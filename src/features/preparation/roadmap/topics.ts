import type { PracticeKind, RoadmapLevel, RoadmapTopic, RoadmapTrack } from './types';

/**
 * Topic-wise roadmap. Every link was opened on 2026-10-17 and points at a section, chapter,
 * problem, or exercise rather than a homepage. Prompts are scoped practice instructions written
 * for this extension; they contain no copied answers. Section anchors for GitHub Markdown were
 * derived from the files' headings at that date.
 */
const VERIFIED = '2026-10-17';

const coreCs = (file: string, anchor: string) =>
  `https://github.com/kratos0718/core-cs-interview-prep/blob/main/${file}/questions.md#${anchor}`;
const os = (anchor: string) => coreCs('04_os', anchor);
const dbms = (anchor: string) => coreCs('03_dbms', anchor);
const net = (anchor: string) => coreCs('05_networks', anchor);
const oop = (anchor: string) => coreCs('02_oop', anchor);
const primer = (anchor: string) => `https://github.com/donnemartin/system-design-primer#${anchor}`;
const lldProblem = (slug: string) =>
  `https://github.com/ashishps1/awesome-low-level-design/blob/main/problems/${slug}.md#requirements`;
const algomaster = (path: string) => `https://algomaster.io/learn/${path}`;
const algoBlog = (slug: string) => `https://blog.algomaster.io/p/${slug}`;
const ostep = (chapter: string) => `https://pages.cs.wisc.edu/~remzi/OSTEP/${chapter}.pdf`;
const leetcode = (slug: string) => `https://leetcode.com/problems/${slug}/`;
const hackerrank = (slug: string) => `https://www.hackerrank.com/challenges/${slug}/problem`;
const handbook = (path: string) => `https://www.techinterviewhandbook.org/${path}`;
const indiabix = (path: string) => `https://www.indiabix.com/${path}/`;
const indiabixFormulas = (topic: string) => `https://www.indiabix.com/aptitude/${topic}/formulas`;
const whatHappens = (anchor: string) => `https://github.com/alex/what-happens-when#${anchor}`;
const pg = (page: string) => `https://www.postgresql.org/docs/current/${page}.html`;

const CORE_CS = 'Core CS Interview Prep';
const PRIMER = 'System Design Primer';
const ALGOMASTER = 'AlgoMaster';
const LLD_REPO = 'Awesome Low-Level Design';
const OSTEP = 'OSTEP (free textbook)';
const HANDBOOK = 'Tech Interview Handbook';
const INDIABIX = 'IndiaBIX';

type Row = {
  title: string;
  level: RoadmapLevel;
  minutes?: number;
  learn: [source: string, label: string, url: string];
  practice: [kind: PracticeKind, source: string, label: string, url: string, prompt: string];
};

const rows: Record<RoadmapTrack, Row[]> = {
  os: [
    {
      title: 'Processes, threads, and context switches',
      level: 'Foundation',
      learn: [CORE_CS, 'OS § A. Basics & Processes', os('a-basics--processes')],
      practice: [
        'Code',
        'LeetCode',
        '1114. Print in Order',
        leetcode('print-in-order'),
        'Solve Print in Order with a synchronization primitive of your choice. Afterwards explain in two sentences what the three threads share and what each owns.',
      ],
    },
    {
      title: 'CPU scheduling: FCFS, SJF, round-robin, MLFQ',
      level: 'Foundation',
      learn: [OSTEP, 'Chapter 7: Scheduling', ostep('cpu-sched')],
      practice: [
        'Explain',
        CORE_CS,
        'OS § B. Scheduling',
        os('b-scheduling'),
        'Take three jobs with burst times 8, 4, and 2 arriving together. Compute average waiting time under FCFS, SJF, and round-robin with quantum 2, then explain when preemption helps. Check your reasoning against the scheduling questions.',
      ],
    },
    {
      title: 'Race conditions, locks, and critical sections',
      level: 'Intermediate',
      learn: [OSTEP, 'Chapter 28: Locks', ostep('threads-locks')],
      practice: [
        'Code',
        'LeetCode',
        '1115. Print FooBar Alternately',
        leetcode('print-foobar-alternately'),
        'Solve Print FooBar Alternately. Then write down the interleaving that breaks a lock-free version, and name the invariant your solution protects.',
      ],
    },
    {
      title: 'Semaphores, condition variables, and producer–consumer',
      level: 'Intermediate',
      learn: [OSTEP, 'Chapter 30: Condition Variables', ostep('threads-cv')],
      practice: [
        'Code',
        'LeetCode',
        '1117. Building H2O',
        leetcode('building-h2o'),
        'Solve Building H2O using semaphores or a condition variable. State why a single mutex is not enough and what happens if a thread signals before another waits.',
      ],
    },
    {
      title: 'Deadlock: conditions, prevention, avoidance, detection',
      level: 'Intermediate',
      learn: [
        CORE_CS,
        'OS § C. Synchronization & Deadlock',
        os('c-synchronization--deadlock-very-high-frequency'),
      ],
      practice: [
        'Code',
        'LeetCode',
        '1226. The Dining Philosophers',
        leetcode('the-dining-philosophers'),
        'Solve The Dining Philosophers so that no deadlock is possible. Identify which of the four necessary conditions your strategy removes, and sketch the circular-wait case it prevents.',
      ],
    },
    {
      title: 'Virtual memory, paging, and the TLB',
      level: 'Advanced',
      learn: [OSTEP, 'Chapter 18: Paging', ostep('vm-paging')],
      practice: [
        'Explain',
        CORE_CS,
        'OS § D. Memory Management',
        os('d-memory-management'),
        'Trace a virtual address through page-table lookup with a TLB hit, a TLB miss, and a page fault. Explain the cost difference and why multi-level page tables exist. Verify with the memory-management questions.',
      ],
    },
    {
      title: 'Page replacement, thrashing, and the working set',
      level: 'Advanced',
      learn: [OSTEP, 'Chapter 22: Beyond Physical Memory — Policies', ostep('vm-beyondphys')],
      practice: [
        'Explain',
        CORE_CS,
        'OS § D. Memory Management',
        os('d-memory-management'),
        'Run reference string 1 2 3 4 1 2 5 1 2 3 4 5 through FIFO and LRU with three frames, count faults, and show the case where adding a frame increases FIFO faults. Explain thrashing in terms of the working set.',
      ],
    },
    {
      title: 'File systems, I/O, and the OS must-knows',
      level: 'Advanced',
      minutes: 30,
      learn: [OSTEP, 'Chapter 39: Files and Directories', ostep('file-intro')],
      practice: [
        'Explain',
        CORE_CS,
        'OS ⭐ The 12 must-knows',
        os('-if-you-memorizeunderstand-only-12-for-os'),
        'Answer the twelve must-know OS questions aloud in twenty minutes without opening the answers. Mark the ones you could not explain with an example and schedule them for revision.',
      ],
    },
  ],
  dbms: [
    {
      title: 'Relational model, keys, and integrity constraints',
      level: 'Foundation',
      learn: [CORE_CS, 'DBMS § A. Fundamentals', dbms('a-fundamentals')],
      practice: [
        'Explain',
        'PostgreSQL docs',
        'DDL constraints reference',
        pg('ddl-constraints'),
        'Model students, courses, and enrolments as tables. Identify primary, candidate, and foreign keys, then write the CREATE TABLE statements with constraints and name one invalid row each constraint rejects.',
      ],
    },
    {
      title: 'SQL basics: SELECT, WHERE, ORDER BY',
      level: 'Foundation',
      learn: [
        'SQLBolt',
        'Lesson 1: SELECT queries',
        'https://sqlbolt.com/lesson/select_queries_introduction',
      ],
      practice: [
        'Code',
        'HackerRank',
        'Revising the Select Query I',
        hackerrank('revising-the-select-query'),
        'Solve Revising the Select Query I, then the next two challenges in the same series. Explain why filtering happens before ordering in the query lifecycle.',
      ],
    },
    {
      title: 'Joins: inner, outer, self, and anti-joins',
      level: 'Intermediate',
      learn: ['PostgreSQL docs', 'Tutorial: Joins between tables', pg('tutorial-join')],
      practice: [
        'Code',
        'HackerRank',
        'African Cities',
        hackerrank('african-cities'),
        'Solve African Cities with an explicit JOIN. Then rewrite it as a LEFT JOIN and explain what happens to cities whose country row is missing. Finish with the joins questions in the core CS repo if time remains.',
      ],
    },
    {
      title: 'Aggregation: GROUP BY, HAVING, and duplicates',
      level: 'Intermediate',
      learn: [
        'SQLBolt',
        'Lesson 10: Queries with aggregates',
        'https://sqlbolt.com/lesson/select_queries_with_aggregates',
      ],
      practice: [
        'Code',
        'LeetCode',
        '182. Duplicate Emails',
        leetcode('duplicate-emails'),
        'Solve Duplicate Emails with GROUP BY and HAVING, then solve it again with a self-join. Explain why WHERE cannot replace HAVING here.',
      ],
    },
    {
      title: 'Normalization: 1NF to BCNF and when to denormalize',
      level: 'Intermediate',
      learn: [CORE_CS, 'DBMS § B. Normalization', dbms('b-normalization-extremely-high-frequency')],
      practice: [
        'Explain',
        CORE_CS,
        'DBMS § B. Normalization',
        dbms('b-normalization-extremely-high-frequency'),
        'Take an orders spreadsheet with customer name, address, product, price, and quantity in one row. Normalize it step by step to 3NF, naming the anomaly each step removes, then give one reason to denormalize for reads.',
      ],
    },
    {
      title: 'Transactions, ACID, and isolation anomalies',
      level: 'Intermediate',
      learn: ['PostgreSQL docs', 'Transaction isolation levels', pg('transaction-iso')],
      practice: [
        'Explain',
        CORE_CS,
        'DBMS § C. Transactions, ACID, Concurrency',
        dbms('c-transactions-acid-concurrency-high-frequency'),
        'Trace two concurrent withdrawals from one account with a balance check. Name the anomaly, the weakest isolation level that prevents it, and how a lock or MVCC resolves it. Check against the transaction questions.',
      ],
    },
    {
      title: 'Indexing: B-trees, composite keys, and query plans',
      level: 'Advanced',
      learn: [
        'Use The Index, Luke',
        'Anatomy of an SQL index',
        'https://use-the-index-luke.com/sql/anatomy',
      ],
      practice: [
        'Explain',
        CORE_CS,
        'DBMS § D. Indexing & Storage',
        dbms('d-indexing--storage-high-frequency'),
        'Choose an index for queries that filter orders by customer and sort by created_at. Justify the column order, estimate the write cost, and describe a query the index cannot help. Answer the indexing questions as a self-check.',
      ],
    },
    {
      title: 'Subqueries, window functions, and ranking',
      level: 'Advanced',
      minutes: 30,
      learn: ['PostgreSQL docs', 'Tutorial: Window functions', pg('tutorial-window')],
      practice: [
        'Code',
        'LeetCode',
        '178. Rank Scores',
        leetcode('rank-scores'),
        'Solve Rank Scores with a window function and once more with a correlated subquery. Test ties, explain why DENSE_RANK matches the expected output, then attempt 176. Second Highest Salary if time remains.',
      ],
    },
  ],
  cn: [
    {
      title: 'Layered models: OSI and TCP/IP',
      level: 'Foundation',
      learn: [CORE_CS, 'Networks § A. Fundamentals & Models', net('a-fundamentals--models')],
      practice: [
        'Explain',
        CORE_CS,
        'Networks § A. Fundamentals & Models',
        net('a-fundamentals--models'),
        'Trace a browser request through each TCP/IP layer, naming the unit of data and the addressing used at each one. Then explain which OSI layers collapse into which TCP/IP layers and why interviewers still ask about OSI.',
      ],
    },
    {
      title: 'IP addressing, subnetting, and routing',
      level: 'Foundation',
      learn: [ALGOMASTER, 'IP addresses', algomaster('system-design/ip-address')],
      practice: [
        'Explain',
        CORE_CS,
        'Networks § C. Network Layer & IP',
        net('c-network-layer--ip'),
        'Split 192.168.10.0/24 into four equal subnets and list each range, broadcast, and usable hosts. Explain how a host decides whether a destination is local or needs the default gateway, and contrast a switch with a router.',
      ],
    },
    {
      title: 'TCP vs UDP: handshake, reliability, flow and congestion control',
      level: 'Intermediate',
      learn: [
        PRIMER,
        'Transmission control protocol (TCP)',
        primer('transmission-control-protocol-tcp'),
      ],
      practice: [
        'Explain',
        CORE_CS,
        'Networks § B. Transport Layer: TCP/UDP',
        net('b-transport-layer-tcpudp-very-high-frequency'),
        'Draw the three-way handshake and the four-step teardown with sequence numbers. Then argue which protocol a video call, a file download, and DNS should use and why. Check the transport-layer questions afterwards.',
      ],
    },
    {
      title: 'DNS: resolution path, record types, and caching',
      level: 'Intermediate',
      learn: [
        'howdns.works',
        'Episode 1: the request begins (illustrated)',
        'https://howdns.works/ep1/',
      ],
      practice: [
        'Explain',
        'What happens when…',
        'Section: DNS lookup',
        whatHappens('dns-lookup'),
        'Write the complete lookup path for a never-visited hostname: browser cache, OS resolver, recursive resolver, root, TLD, and authoritative servers. Then run `dig` or `nslookup` on a real domain and match the output to your diagram.',
      ],
    },
    {
      title: 'HTTP: methods, status codes, headers, cookies, and caching',
      level: 'Intermediate',
      learn: [
        'MDN',
        'An overview of HTTP',
        'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview',
      ],
      practice: [
        'Explain',
        CORE_CS,
        'Networks § D. Application Layer & Web',
        net('d-application-layer--web-high-frequency'),
        'Run `curl -v` against a public site and annotate every request and response header you see. Explain idempotency of GET/PUT/DELETE versus POST, pick status codes for four failure cases, and describe how Cache-Control and ETag interact.',
      ],
    },
    {
      title: 'TLS and HTTPS: certificates and the handshake',
      level: 'Advanced',
      learn: [
        'howhttps.works',
        'The handshake (illustrated)',
        'https://howhttps.works/the-handshake/',
      ],
      practice: [
        'Explain',
        'What happens when…',
        'Section: TLS handshake',
        whatHappens('tls-handshake'),
        'Walk through a TLS 1.3 handshake, including how the certificate chain is verified and where the symmetric key comes from. Then list two threats HTTPS stops and two it does not.',
      ],
    },
    {
      title: 'Network security: firewalls, NAT, and common attacks',
      level: 'Advanced',
      learn: [CORE_CS, 'Networks § F. Security & Advanced', net('f-security--advanced')],
      practice: [
        'Explain',
        CORE_CS,
        'Networks § F. Security & Advanced',
        net('f-security--advanced'),
        'Explain how NAT lets many devices share one public address and why it complicates inbound connections. Then describe a SYN flood, a DNS spoofing attack, and a man-in-the-middle attack with one mitigation each.',
      ],
    },
    {
      title: 'What happens when you type a URL: the end-to-end story',
      level: 'Advanced',
      minutes: 30,
      learn: [
        'What happens when…',
        'Full walkthrough from keypress to render',
        whatHappens('parse-url'),
      ],
      practice: [
        'Explain',
        CORE_CS,
        'Networks ⭐ The 12 must-knows',
        net('-the-12-networks-must-knows'),
        'Deliver the whole URL-to-page story in under five minutes, timed, hitting DNS, TCP, TLS, HTTP, and rendering. Then answer the twelve networks must-knows without the answers visible.',
      ],
    },
  ],
  oop: [
    {
      title: 'Classes, objects, encapsulation, and abstraction',
      level: 'Foundation',
      learn: [ALGOMASTER, 'Encapsulation', algomaster('lld/encapsulation')],
      practice: [
        'Explain',
        CORE_CS,
        'OOP § A. Core concepts & the 4 pillars',
        oop('a-core-concepts--the-4-pillars'),
        'Design a BankAccount class whose balance can never go negative from outside. Show the public API, the hidden invariant, and explain how encapsulation differs from abstraction with this example rather than definitions.',
      ],
    },
    {
      title: 'Inheritance, polymorphism, and dynamic dispatch',
      level: 'Foundation',
      learn: [ALGOMASTER, 'Polymorphism', algomaster('lld/polymorphism')],
      practice: [
        'Code',
        'LeetCode',
        '1603. Design Parking System',
        leetcode('design-parking-system'),
        'Solve Design Parking System, then refactor it so each vehicle size is a subtype or strategy chosen without an if-chain. Explain the difference between overloading and overriding in your language.',
      ],
    },
    {
      title: 'Interfaces and composition over inheritance',
      level: 'Intermediate',
      learn: [ALGOMASTER, 'Composition', algomaster('lld/composition')],
      practice: [
        'Explain',
        CORE_CS,
        'OOP § B. Inheritance deep-dive',
        oop('b-inheritance-deep-dive'),
        'Model vehicles that can have different engines. Show the inheritance version, show the composition version with an Engine interface, and explain which change requests break each design. Review the inheritance questions afterwards.',
      ],
    },
    {
      title: 'SOLID principles applied to real code',
      level: 'Intermediate',
      learn: [
        ALGOMASTER,
        'SOLID principles explained with code',
        algoBlog('solid-principles-explained-with-code'),
      ],
      practice: [
        'Code',
        'GitHub (Emily Bache)',
        'Gilded Rose refactoring kata',
        'https://github.com/emilybache/GildedRose-Refactoring-Kata',
        'Clone the Gilded Rose kata in your language, add characterization tests, then refactor the update logic toward open/closed and single responsibility. Stop after thirty minutes and note which principle guided each change.',
      ],
    },
    {
      title: 'Design patterns I: Strategy, Observer, Factory Method',
      level: 'Intermediate',
      learn: [
        'Refactoring.Guru',
        'Strategy pattern',
        'https://refactoring.guru/design-patterns/strategy',
      ],
      practice: [
        'Code',
        'Refactoring.Guru',
        'Observer pattern (problem and structure)',
        'https://refactoring.guru/design-patterns/observer',
        'Implement a price-alert feature: a Stock publishes updates and two different subscribers react. Use Observer for delivery and Strategy for the alert rule. Write a test that unsubscribes mid-stream.',
      ],
    },
    {
      title: 'Design patterns II: State, Builder, Decorator, Singleton',
      level: 'Advanced',
      learn: [
        'Refactoring.Guru',
        'State pattern',
        'https://refactoring.guru/design-patterns/state',
      ],
      practice: [
        'Code',
        'Kata-Log',
        'Mars Rover kata',
        'https://kata-log.rocks/mars-rover-kata',
        'Implement the Mars Rover with commands parsed into objects and heading handled by the State pattern instead of a switch. Add a Builder for the grid setup and explain when Singleton would be a mistake here.',
      ],
    },
    {
      title: 'Language mechanics: equality, copying, memory, exceptions',
      level: 'Advanced',
      learn: [
        CORE_CS,
        'OOP § E. Language-mechanics & gotchas',
        oop('e-language-mechanics--gotchas'),
      ],
      practice: [
        'Explain',
        CORE_CS,
        'OOP § E. Language-mechanics & gotchas',
        oop('e-language-mechanics--gotchas'),
        'In your primary language, demonstrate shallow versus deep copy, the equals/hashCode (or __eq__/__hash__) contract, and a bug caused by a mutable object used as a map key. Explain checked versus unchecked exceptions or your language’s equivalent.',
      ],
    },
    {
      title: 'UML class diagrams and the OOP must-knows',
      level: 'Advanced',
      minutes: 30,
      learn: [ALGOMASTER, 'Class diagram', algomaster('lld/class-diagram')],
      practice: [
        'Explain',
        CORE_CS,
        'OOP ⭐ The 10 must-knows',
        oop('-the-10-oop-must-knows'),
        'Draw a class diagram for a library with members, books, and loans, using correct arrows for inheritance, composition, and association. Then answer the ten OOP must-knows aloud, timed.',
      ],
    },
  ],
  hld: [
    {
      title: 'How to approach a system design question',
      level: 'Foundation',
      learn: [
        PRIMER,
        'How to approach a system design interview question',
        primer('how-to-approach-a-system-design-interview-question'),
      ],
      practice: [
        'Design',
        PRIMER,
        'Exercise: Design Pastebin.com (or Bit.ly)',
        primer('design-pastebincom-or-bitly'),
        'Start the URL shortener exercise and stop after step one: write the use cases, constraints, and assumptions on one page, then list the clarifying questions you would ask. Do not open the sample solution yet.',
      ],
    },
    {
      title: 'Scalability, latency vs throughput, and estimation',
      level: 'Foundation',
      learn: [
        PRIMER,
        'Back-of-the-envelope calculations',
        primer('back-of-the-envelope-calculations'),
      ],
      practice: [
        'Design',
        PRIMER,
        'Latency numbers every programmer should know',
        primer('latency-numbers-every-programmer-should-know'),
        'For your URL shortener assume 100 million new links per month and a 10:1 read/write ratio. Estimate write QPS, read QPS, storage over five years, and bandwidth. Then explain which latency number dominates a redirect.',
      ],
    },
    {
      title: 'Load balancing and horizontal scaling',
      level: 'Intermediate',
      learn: [
        ALGOMASTER,
        'Load balancing algorithms explained with code',
        algoBlog('load-balancing-algorithms-explained-with-code'),
      ],
      practice: [
        'Design',
        ALGOMASTER,
        'Exercise: Design a Load Balancer',
        algomaster('system-design-interviews/design-load-balancer'),
        'Design the request-distribution layer for three API servers. Compare round-robin with least-connections, add health checks, and explain how a failed server leaves rotation and how sticky sessions change the design.',
      ],
    },
    {
      title: 'Caching strategies, invalidation, and eviction',
      level: 'Intermediate',
      learn: [PRIMER, 'Cache: when to update the cache', primer('when-to-update-the-cache')],
      practice: [
        'Design',
        PRIMER,
        'Exercise: Design Pastebin.com (or Bit.ly)',
        primer('design-pastebincom-or-bitly'),
        'Add a cache to the URL shortener read path. Choose cache-aside or read-through, pick an eviction policy and TTL, describe one stale-read scenario, and state what happens when the cache cluster is unavailable.',
      ],
    },
    {
      title: 'Databases at scale: replication, sharding, SQL vs NoSQL',
      level: 'Intermediate',
      learn: [PRIMER, 'Database: replication, federation, sharding', primer('database')],
      practice: [
        'Design',
        ALGOMASTER,
        'Exercise: Design URL Shortener like TinyURL',
        algomaster('system-design-interviews/design-url-shortener'),
        'Complete the URL shortener design: data model, key generation, redirect path, and a sharding scheme for the links table. Name the hot-spot risk of your shard key and how replication affects read consistency.',
      ],
    },
    {
      title: 'Availability, consistency, and the CAP theorem',
      level: 'Advanced',
      learn: [PRIMER, 'Availability vs consistency', primer('availability-vs-consistency')],
      practice: [
        'Design',
        PRIMER,
        'Exercise: Design a key-value store for a search engine',
        primer('design-a-key-value-store-for-a-search-engine'),
        'Design the key-value cache for search results. Decide between CP and AP, choose a consistency pattern, and show how a node failure is handled with replication. Attempt it fully before reading the sample solution.',
      ],
    },
    {
      title: 'Message queues, async processing, and rate limiting',
      level: 'Advanced',
      learn: [PRIMER, 'Asynchronism: message and task queues', primer('asynchronism')],
      practice: [
        'Code',
        ALGOMASTER,
        'Rate limiting algorithms explained with code',
        algoBlog('rate-limiting-algorithms-explained-with-code'),
        'Implement a token-bucket rate limiter in your language with tests for burst and steady-state traffic. Then design where it sits in the URL shortener (gateway vs service) and how it behaves across multiple instances.',
      ],
    },
    {
      title: 'Full design exercise: web crawler and news feed',
      level: 'Advanced',
      minutes: 30,
      learn: [
        PRIMER,
        'Design the Twitter timeline and search',
        primer('design-the-twitter-timeline-and-search-or-facebook-feed-and-search'),
      ],
      practice: [
        'Design',
        PRIMER,
        'Exercise: Design a web crawler',
        primer('design-a-web-crawler'),
        'Design a web crawler in thirty minutes as if in an interview: frontier queue, duplicate detection, politeness and rate limits, worker failure recovery, and storage. Compare your answer with the solution only after your timer ends.',
      ],
    },
  ],
  lld: [
    {
      title: 'The LLD interview method: requirements to classes',
      level: 'Foundation',
      learn: [
        ALGOMASTER,
        'How to answer a LLD interview problem',
        algoBlog('how-to-answer-a-lld-interview-problem'),
      ],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design Tic Tac Toe (requirements)',
        lldProblem('tic-tac-toe'),
        'Read only the requirements, list entities and their responsibilities, then implement move validation plus win and draw detection with tests for repeated moves and moves after game over. Open the reference solution afterwards.',
      ],
    },
    {
      title: 'Class relationships and the Parking Lot',
      level: 'Foundation',
      learn: [ALGOMASTER, 'Association, aggregation, composition', algomaster('lld/association')],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design Parking Lot (requirements)',
        lldProblem('parking-lot'),
        'Implement a parking lot slice: levels, typed spots, park and unpark. Write tests for a full lot and a double release, and mark which relationships are composition versus aggregation in your classes.',
      ],
    },
    {
      title: 'State machines: the Vending Machine',
      level: 'Intermediate',
      learn: [ALGOMASTER, 'State pattern', algomaster('lld/state')],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design a Vending Machine (requirements)',
        lldProblem('vending-machine'),
        'Implement selection, payment, and dispense as explicit states. Test insufficient money, out-of-stock, and cancel-with-refund before comparing with the reference implementation.',
      ],
    },
    {
      title: 'Data-structure design: the LRU Cache',
      level: 'Intermediate',
      learn: [ALGOMASTER, 'Interfaces', algomaster('lld/interfaces')],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design LRU Cache (requirements)',
        lldProblem('lru-cache'),
        'Implement get and put in O(1) behind a Cache interface using a hash map and a doubly linked list. Test updating an existing key, a capacity-one cache, and eviction order. Then discuss how you would make it thread-safe.',
      ],
    },
    {
      title: 'Observer and event delivery: the Pub/Sub system',
      level: 'Intermediate',
      learn: [ALGOMASTER, 'Observer pattern', algomaster('lld/observer')],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design Pub Sub System (requirements)',
        lldProblem('pub-sub-system'),
        'Implement topics, publishers, and subscribers with unsubscribe. Add a test for a slow subscriber and decide whether delivery is synchronous or queued, documenting the trade-off in a comment.',
      ],
    },
    {
      title: 'Strategy and scheduling: the Elevator system',
      level: 'Intermediate',
      learn: [ALGOMASTER, 'Strategy pattern', algomaster('lld/strategy')],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design an Elevator System (requirements)',
        lldProblem('elevator-system'),
        'Implement request handling for two elevators with a pluggable dispatch strategy. Test that a request is served by the nearest idle elevator and that direction changes only at the end of a run.',
      ],
    },
    {
      title: 'Concurrency in LLD: a thread-safe blocking queue',
      level: 'Advanced',
      learn: [
        ALGOMASTER,
        'Producer–consumer pattern',
        algomaster('concurrency-interview/producer-consumer-pattern'),
      ],
      practice: [
        'Code',
        ALGOMASTER,
        'Problem: Design a thread-safe blocking queue',
        algomaster('concurrency-interview/design-thread-safe-blocking-queue'),
        'Implement a bounded blocking queue with put and take that block when full or empty. Test with two producers and two consumers and explain why you used a condition variable rather than busy-waiting.',
      ],
    },
    {
      title: 'Machine coding round: Splitwise',
      level: 'Advanced',
      minutes: 30,
      learn: [ALGOMASTER, 'Sequence diagram', algomaster('lld/sequence-diagram')],
      practice: [
        'Code',
        LLD_REPO,
        'Problem: Design Splitwise (requirements)',
        lldProblem('splitwise'),
        'In a timed thirty-minute block, implement users, groups, and equal and exact expense splits with a balance sheet. Add a test showing balances net to zero. Note what you would simplify under interview time pressure.',
      ],
    },
  ],
  aptitude: [
    {
      title: 'Percentages and percentage change',
      level: 'Foundation',
      minutes: 20,
      learn: [INDIABIX, 'Percentage: important formulas', indiabixFormulas('percentage')],
      practice: [
        'Practice',
        INDIABIX,
        'Percentage practice questions',
        indiabix('aptitude/percentage'),
        'Attempt the first ten percentage questions in fifteen minutes without opening explanations. Record your score, then redo every miss while stating which base the percentage is taken on.',
      ],
    },
    {
      title: 'Ratio, proportion, and partnership',
      level: 'Foundation',
      minutes: 20,
      learn: [
        INDIABIX,
        'Ratio and proportion: important formulas',
        indiabixFormulas('ratio-and-proportion'),
      ],
      practice: [
        'Practice',
        INDIABIX,
        'Ratio and proportion practice questions',
        indiabix('aptitude/ratio-and-proportion'),
        'Attempt ten ratio and proportion questions in fifteen minutes. For each, write the ratio before computing; afterwards explain how the answer changes when the total changes but the ratio does not.',
      ],
    },
    {
      title: 'Profit, loss, and discount',
      level: 'Foundation',
      minutes: 20,
      learn: [INDIABIX, 'Profit and loss: important formulas', indiabixFormulas('profit-and-loss')],
      practice: [
        'Practice',
        INDIABIX,
        'Profit and loss practice questions',
        indiabix('aptitude/profit-and-loss'),
        'Attempt ten profit and loss questions timed. Mark which ones involve successive discounts or marked price, and derive the single-step formula you used.',
      ],
    },
    {
      title: 'Time and work, pipes and cisterns',
      level: 'Intermediate',
      minutes: 20,
      learn: [INDIABIX, 'Time and work: important formulas', indiabixFormulas('time-and-work')],
      practice: [
        'Practice',
        INDIABIX,
        'Time and work practice questions',
        indiabix('aptitude/time-and-work'),
        'Attempt ten time-and-work questions using the rate-per-day model. Then solve three pipes-and-cistern questions and explain why an outlet pipe is a negative rate.',
      ],
    },
    {
      title: 'Time, speed, and distance, including trains',
      level: 'Intermediate',
      minutes: 20,
      learn: [
        INDIABIX,
        'Time and distance: important formulas',
        indiabixFormulas('time-and-distance'),
      ],
      practice: [
        'Practice',
        INDIABIX,
        'Time and distance practice questions',
        indiabix('aptitude/time-and-distance'),
        'Attempt ten speed-distance questions timed, converting km/h to m/s consistently. Then solve three problems on trains and explain relative speed for same and opposite directions.',
      ],
    },
    {
      title: 'Permutations and combinations',
      level: 'Advanced',
      minutes: 25,
      learn: [
        INDIABIX,
        'Permutation and combination: important formulas',
        indiabixFormulas('permutation-and-combination'),
      ],
      practice: [
        'Practice',
        INDIABIX,
        'Permutation and combination practice questions',
        indiabix('aptitude/permutation-and-combination'),
        'Attempt ten counting questions. Before each answer state whether order matters and whether repetition is allowed; afterwards find any question where you overcounted and explain the fix.',
      ],
    },
    {
      title: 'Probability',
      level: 'Advanced',
      minutes: 25,
      learn: [INDIABIX, 'Probability: important formulas', indiabixFormulas('probability')],
      practice: [
        'Practice',
        INDIABIX,
        'Probability practice questions',
        indiabix('aptitude/probability'),
        'Attempt ten probability questions, writing the sample space or the conditioning event for each. Check every answer stays within 0 and 1 and explain one case where events are not independent.',
      ],
    },
    {
      title: 'Logical reasoning: series, syllogisms, and seating',
      level: 'Advanced',
      minutes: 25,
      learn: [INDIABIX, 'Number series practice', indiabix('logical-reasoning/number-series')],
      practice: [
        'Practice',
        INDIABIX,
        'Syllogism practice questions',
        indiabix('verbal-reasoning/syllogism'),
        'Attempt ten number series questions in ten minutes, then ten syllogisms using Venn diagrams. Finish with two seating-arrangement puzzles from the same site, drawing the arrangement before answering.',
      ],
    },
  ],
  interviews: [
    {
      title: 'A concise self-introduction',
      level: 'Foundation',
      minutes: 20,
      learn: [
        HANDBOOK,
        'Self introduction: make an elevator pitch',
        handbook('self-introduction/#make-an-elevator-pitch'),
      ],
      practice: [
        'Practice',
        HANDBOOK,
        'Self introduction: practice',
        handbook('self-introduction/#4-practice'),
        'Record a 60–90 second introduction grounded in your real projects and interests. Listen back, remove any claim you could not defend in a follow-up, and record it once more.',
      ],
    },
    {
      title: 'Resume: ATS-friendly structure and strong bullets',
      level: 'Foundation',
      minutes: 25,
      learn: [
        HANDBOOK,
        'How to write good resume content',
        handbook('resume/#how-to-write-good-software-engineer-resume-content'),
      ],
      practice: [
        'Practice',
        HANDBOOK,
        'Tools to review your resume',
        handbook('resume/#tools-to-review-your-resume'),
        'Run the plain-text test on your resume and fix anything that breaks. Rewrite your three weakest bullets in the action–context–result form with a measurable outcome.',
      ],
    },
    {
      title: 'Behavioral stories with the STAR format',
      level: 'Intermediate',
      learn: [
        HANDBOOK,
        'Learn the STAR answer format',
        handbook('behavioral-interview/#1-learn-the-star-answer-format'),
      ],
      practice: [
        'Practice',
        HANDBOOK,
        'Most commonly asked behavioral questions',
        handbook(
          'behavioral-interview-questions/#most-commonly-asked-behavioral-questions-across-top-tech-companies',
        ),
        'Pick one conflict and one failure question from the list. Answer each in STAR form from a real experience, out loud, and check that the Action section is yours alone and the Result is specific.',
      ],
    },
    {
      title: 'The big three: yourself, this company, your project',
      level: 'Intermediate',
      learn: [
        HANDBOOK,
        'Prepare answers to the big three questions',
        handbook('behavioral-interview/#3-prepare-answers-to-the-big-three-questions'),
      ],
      practice: [
        'Practice',
        HANDBOOK,
        'Organize your key stories',
        handbook('behavioral-interview/#2-organize-your-key-stories'),
        'Write a story bank of five experiences and map each to at least two question types. Then explain your best project covering your individual contribution, one technical decision, the alternative you rejected, and the evidence it worked.',
      ],
    },
    {
      title: 'Coding interview conduct: clarify, think aloud, test',
      level: 'Intermediate',
      learn: [
        HANDBOOK,
        'What to do during your coding interview',
        handbook('coding-interview-cheatsheet/#what-to-do-during-your-coding-interview'),
      ],
      practice: [
        'Practice',
        HANDBOOK,
        'Upon receiving the question, make clarifications',
        handbook('coding-interview-cheatsheet/#2-upon-receiving-the-question-make-clarifications'),
        'Solve today’s Striver problem as a mock: say the clarifying questions aloud, state the brute force and its complexity before optimizing, and walk your final code through two test cases before submitting.',
      ],
    },
    {
      title: 'How interviewers grade you: behavioral rubrics',
      level: 'Advanced',
      learn: [
        HANDBOOK,
        'How behavioral interviews are evaluated',
        handbook('behavioral-interview-rubrics/#how-behavioral-interviews-are-evaluated'),
      ],
      practice: [
        'Practice',
        HANDBOOK,
        'Example questions and responses',
        handbook('behavioral-interview-rubrics/#example-questions-and-responses'),
        'Grade two of your own STAR stories against the rubric signals, honestly. Rewrite the weaker one so that it shows proactivity and growth with concrete actions.',
      ],
    },
    {
      title: 'Questions to ask and running a mock interview',
      level: 'Advanced',
      minutes: 30,
      learn: [HANDBOOK, 'Final questions to ask the interviewer', handbook('final-questions/')],
      practice: [
        'Practice',
        HANDBOOK,
        'Try out mock behavioral interviews',
        handbook('behavioral-interview/#6-try-out-mock-behavioral-interviews'),
        'Run a twenty-minute mock with a peer or a recording: introduction, two behavioral questions, and three questions you ask them. Note which follow-ups exposed gaps and pick one improvement for next time.',
      ],
    },
    {
      title: 'Offers: compensation basics and negotiation',
      level: 'Advanced',
      learn: [HANDBOOK, 'Negotiation: always negotiate', handbook('negotiation/#always-negotiate')],
      practice: [
        'Practice',
        HANDBOOK,
        'Understanding compensation',
        handbook('understanding-compensation/'),
        'Write the questions you would ask about an offer’s components and the one polite negotiation message you would send with a competing data point. Rehearse it aloud once.',
      ],
    },
  ],
};

const resourceIds: Record<RoadmapTrack, string> = {
  os: 'core-cs-questions',
  dbms: 'core-cs-questions',
  cn: 'core-cs-questions',
  oop: 'lld',
  hld: 'hld-additional',
  lld: 'lld',
  aptitude: 'aptitude',
  interviews: 'interviews',
};

const PRACTICE_NOTE: Record<PracticeKind, string> = {
  Explain:
    'Explain it independently first; the linked questions include answers for a self-check afterwards.',
  Code: 'Attempt the brief before opening any reference solution. A platform account may be required.',
  Design:
    'Write your design before reading the sample solution linked on the same page or repository.',
  Practice: 'Opening the link records nothing; record your result here when you finish.',
};
export const practiceNote = (kind: PracticeKind) => PRACTICE_NOTE[kind];

export const ROADMAP_TRACK_ORDER = Object.keys(rows) as RoadmapTrack[];
const longest = Math.max(...ROADMAP_TRACK_ORDER.map((track) => rows[track].length));

/** Stage-major order: every track's first topic, then every track's second topic, and so on. */
export const roadmapTopics: RoadmapTopic[] = Array.from({ length: longest }, (_, index) =>
  ROADMAP_TRACK_ORDER.flatMap((track): RoadmapTopic[] => {
    const row = rows[track][index];
    if (!row) return [];
    const [learnSource, learnLabel, learnUrl] = row.learn;
    const [kind, practiceSource, practiceLabel, practiceUrl, prompt] = row.practice;
    return [
      {
        id: `${track}-${index + 1}`,
        track,
        stage: index + 1,
        title: row.title,
        level: row.level,
        minutes: row.minutes ?? 25,
        prerequisites: index ? [`${track}-${index}`] : [],
        resourceId: resourceIds[track],
        learn: { source: learnSource, label: learnLabel, url: learnUrl },
        practice: { kind, source: practiceSource, label: practiceLabel, url: practiceUrl, prompt },
        verifiedAt: VERIFIED,
      },
    ];
  }),
).flat();

const byId = new Map(roadmapTopics.map((topic) => [topic.id, topic]));
export const roadmapTopicById = (id: string) => byId.get(id);
export const roadmapTopicsForTrack = (track: RoadmapTrack) =>
  roadmapTopics.filter((topic) => topic.track === track);
