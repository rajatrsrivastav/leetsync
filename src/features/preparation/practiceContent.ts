import type { Lesson, Resource, Role } from './types';

const allRoles: Role[] = ['software', 'backend', 'fullstack', 'analyst'];
const engineering: Role[] = ['software', 'backend', 'fullstack'];
const resource = (
  title: string,
  url: string,
  publisher: string,
  verification: Resource['verification'] = 'verified',
  note?: string,
): Resource => ({ title, url, publisher, verifiedAt: '2026-10-15', verification, note });

const sources = {
  striver: resource(
    'Striver’s 180: official study sheet',
    'https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns',
    'takeUforward',
  ),
  leetcode: resource(
    'Top Interview 150 study plan',
    'https://leetcode.com/studyplan/top-interview-150/',
    'LeetCode',
  ),
  merge: resource(
    'Practice: Merge Sorted Array',
    'https://leetcode.com/problems/merge-sorted-array/',
    'LeetCode',
  ),
  codeforces: resource(
    'Codeforces problem archive',
    'https://codeforces.com/problemset',
    'Codeforces',
  ),
  watermelon: resource(
    'Practice: 4A — Watermelon',
    'https://codeforces.com/problemset/problem/4/A',
    'Codeforces',
  ),
  hackerrank: resource(
    'Data Structures practice',
    'https://www.hackerrank.com/domains/data-structures',
    'HackerRank',
  ),
  arrays: resource(
    'Practice: Arrays — DS',
    'https://www.hackerrank.com/challenges/arrays-ds/problem',
    'HackerRank',
  ),
  gfg: resource(
    'GeeksforGeeks practice catalogue',
    'https://www.geeksforgeeks.org/explore',
    'GeeksforGeeks',
    'restricted',
    'Official indexed catalogue confirmed; direct automated access was restricted. Open in your browser; sign-in may be required.',
  ),
  percent: resource(
    'Understand Percent',
    'https://openstax.org/books/prealgebra-2e/pages/6-1-understand-percent',
    'OpenStax',
  ),
  probability: resource(
    'Probability terminology',
    'https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology',
    'OpenStax',
  ),
  logic: resource(
    'Mathematics for Computer Science',
    'https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/',
    'MIT OpenCourseWare',
  ),
  concision: resource(
    'Concision in writing',
    'https://owl.purdue.edu/owl/general_writing/academic_writing/conciseness/index.html',
    'Purdue OWL',
  ),
  technical: resource(
    'Technical interview guidance',
    'https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing',
    'Microsoft Careers',
  ),
  interviews: resource(
    'Interview preparation tips',
    'https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips',
    'Microsoft Careers',
  ),
  star: resource(
    'STAR method and behavioral interview worksheet',
    'https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/',
    'MIT Career Advising',
    'restricted',
    'Official search listing verified; direct page returned a rate limit during review.',
  ),
  resume: resource(
    'Guide to creating a strong resume',
    'https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/',
    'Harvard Mignone Center for Career Success',
  ),
  amazonSde: resource(
    'University SDE online assessment preparation',
    'https://www.amazon.jobs/content/en/how-we-hire/university/sde-oa',
    'Amazon Jobs',
  ),
  amazonBie: resource(
    'Business Intelligence Engineer interview preparation',
    'https://www.amazon.jobs/content/en/how-we-hire/bie-interview-prep',
    'Amazon Jobs',
  ),
};

/** Original exercises; employer links describe preparation, not provenance for our questions. */
export const practiceLessons: Lesson[] = [
  {
    id: 'prep-dsa-deliberate',
    subject: 'dsa',
    title: 'Deliberate DSA practice: from constraints to evidence',
    summary: 'Use Striver and LeetCode without replacing your existing curriculum progress.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: [],
    roles: engineering,
    concept:
      'A useful solve produces a justified approach, adversarial tests, and a clear record of the help you needed.',
    explanation: [
      'Before coding, restate the input and output, identify what can vary, and write the smallest cases. Describe a direct approach in your own words before looking for a faster one.',
      'Ask what information repeats and what must remain true as you process the input. A pattern is a hypothesis to justify, not a keyword to match. State the assumptions behind any time or space bound.',
      'Continue your existing Striver queue in the DSA area. This preparation lesson records a separate study session; completing it does not mark a LeetCode problem solved or change the 2-question curriculum goal.',
    ],
    example:
      'For an original task that counts positive readings, [] gives 0, [0] gives 0, and [-3, 5, 5] gives 2. These examples clarify that zero is excluded and repeated positive values each count. They test the specification before any implementation choice.',
    questions: [
      'What does your first approach repeat unnecessarily?',
      'Which assumption would make your proposed optimization invalid?',
      'How would you test correctness without trusting the sample alone?',
    ],
    practice:
      'Choose the next unsolved problem in your existing Striver queue, or open Merge Sorted Array as an optional extra. Spend 5 minutes on constraints and examples, 15 on an independent attempt, and 5 recording a remaining question. Keep editorials closed during the attempt. Record outside help honestly.',
    checkpoints: [
      'Restated the contract and input variables',
      'Wrote a direct approach and at least three edge cases',
      'Recorded help used and a question to revisit',
    ],
    resources: [sources.striver, sources.leetcode, sources.merge],
  },
  {
    id: 'prep-dsa-contest',
    subject: 'dsa',
    title: 'Codeforces: reading constraints under a time budget',
    summary: 'Practice small contest problems, boundary cases, and post-contest review.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['prep-dsa-deliberate'],
    roles: engineering,
    concept:
      'Contest readiness combines precise reading, a correct argument, and disciplined time allocation.',
    explanation: [
      'Check whether the input has one case or multiple cases, whether values may be zero or negative, and whether output formatting is strict. Translate every condition into something you can test.',
      'Before submitting, challenge your reasoning using the smallest legal input and the boundary at which your answer changes. A passing sample is evidence about one case, not a proof.',
      'External practice is manual: DSACommit does not detect Codeforces, GFG, or HackerRank verdicts. Keep the problem URL, actual verdict, elapsed time, and what you learned in the session reflection.',
    ],
    example:
      'An original specification allows a team of at least 3 and at most 8 people. Test sizes 2, 3, 8, and 9. If an implementation rejects 3, the defect is the boundary interpretation; there is no need to change its entire approach.',
    questions: [
      'Which word in the statement changes the smallest valid case?',
      'What is your stopping rule before switching to another question?',
      'Can you explain why the boundary cases cover your decision rules?',
    ],
    practice:
      'Try Codeforces 4A — Watermelon for 15 minutes without an editorial. If already familiar, choose an unfamiliar beginner problem from the archive. Spend 10 minutes testing or reviewing; if you read help, describe exactly what changed your reasoning. Record the external verdict manually.',
    checkpoints: [
      'Read the complete input/output specification',
      'Tested both sides of a boundary',
      'Recorded a real verdict or clearly marked unfinished',
    ],
    resources: [sources.watermelon, sources.codeforces],
  },
  {
    id: 'prep-dsa-transfer',
    subject: 'dsa',
    title: 'Transfer a pattern across HackerRank and GFG',
    summary: 'Separate reusable reasoning from platform-specific templates.',
    minutes: 30,
    level: 'Practice',
    prerequisites: ['prep-dsa-deliberate'],
    roles: engineering,
    concept:
      'Transfer means recognizing a useful property in a new problem without assuming that a familiar title implies the same solution.',
    explanation: [
      'A platform may ask you to return a value, mutate an input, or print to standard output. Confirm the contract before copying any function signature or testing harness.',
      'After two attempts, compare the reasoning rather than the code: the operations allowed, the state you tracked, the invariant, and the cases that broke your first idea. Explain one important difference.',
      'Use the official catalogues to choose practice. GFG and HackerRank completion here is self-reported, and this lesson never creates a verified Accepted submission or a GitHub solution commit.',
    ],
    example:
      'An operation that returns a changed copy and one that edits the original collection can produce identical printed output but have different contracts and memory costs. A test that inspects the original collection after the call distinguishes them.',
    questions: [
      'What does the caller expect to remain unchanged?',
      'Which property of the data justified your approach?',
      'What new constraint would force you to reconsider the pattern?',
    ],
    practice:
      'Attempt HackerRank Arrays — DS, then select one unfamiliar array problem from the GFG catalogue. Keep each attempt to 10 minutes and use the final 10 minutes to compare contracts and edge cases. Store both URLs and help used in your reflection; verify verdicts on the source sites.',
    checkpoints: [
      'Checked mutation and return-value contracts',
      'Compared two problems using reasoning rather than titles',
      'Kept source URLs and honest completion evidence',
    ],
    resources: [sources.arrays, sources.hackerrank, sources.gfg],
  },
  {
    id: 'prep-apt-percent',
    subject: 'aptitude',
    title: 'Quantitative: ratios, percentages, and changing bases',
    summary: 'Translate word problems into quantities and avoid percentage-base traps.',
    minutes: 20,
    level: 'Foundation',
    prerequisites: [],
    roles: allRoles,
    concept:
      'A percentage has meaning only relative to its base; a ratio compares quantities using a common scale.',
    explanation: [
      'For a percentage change, write new value = old value × multiplier. An increase of 15% uses 1.15; a decrease of 15% uses 0.85. Successive changes multiply because the base changes.',
      'For a ratio a:b, represent the quantities as ak and bk. Find k from a total or a difference before calculating the requested quantity. Preserve units through the calculation.',
      'Estimate the expected direction and size of the result before computing. Then substitute your result back into the statement; a fast arithmetic answer to the wrong base is still wrong.',
    ],
    example:
      'A fee of ₹800 rises by 10% and then falls by 10%. The new fee is 800 × 1.10 × 0.90 = ₹792, a decrease of ₹8 overall. The second change acts on ₹880, so the equal percentage changes do not cancel.',
    questions: [
      'Which quantity is the base of each percentage?',
      'Can you represent the ratio using a single unknown?',
      'Does your answer have the units and direction you expected?',
    ],
    practice:
      'Use an 8-minute budget for the quiz without notes. After answering, explain each denominator aloud and recompute one question using a different method. Record any base-confusion mistake for revision.',
    checkpoints: [
      'Identified bases before calculating',
      'Checked ratio totals',
      'Explained one incorrect option',
    ],
    resources: [sources.percent],
    quiz: [
      {
        id: 'percent-1',
        prompt: 'A price of ₹500 increases by 20%, then decreases by 20%. What is the final price?',
        options: ['₹500', '₹480', '₹520', '₹400'],
        answer: 1,
        explanation: '500 × 1.20 × 0.80 = 480. The discount acts on ₹600, not ₹500.',
      },
      {
        id: 'percent-2',
        prompt: 'A:B = 3:5 and A + B = 64. What is B?',
        options: ['24', '32', '40', '48'],
        answer: 2,
        explanation: 'There are 8 equal parts, each worth 64/8 = 8. B contains 5 parts, so B = 40.',
      },
      {
        id: 'percent-3',
        prompt:
          'A conversion rate rises from 40% to 50%. What is its relative percentage increase?',
        options: ['10%', '20%', '25%', '50%'],
        answer: 2,
        explanation:
          'The increase is 10 percentage points. Relative to the original 40%, it is 10/40 × 100 = 25%.',
      },
    ],
  },
  {
    id: 'prep-apt-rates',
    subject: 'aptitude',
    title: 'Quantitative: rates, averages, and probability',
    summary: 'Use totals and clearly defined sample spaces instead of memorized shortcuts.',
    minutes: 25,
    level: 'Practice',
    prerequisites: ['prep-apt-percent'],
    roles: allRoles,
    concept:
      'Rates are amounts per unit; averages and probabilities depend on the correct denominator.',
    explanation: [
      'For independent workers with constant rates, add work per hour rather than completion times. Average speed is total distance divided by total time, so averaging two speeds is valid only for equal time spent at each speed.',
      'For probability, specify equally likely outcomes before counting. When drawing without replacement, the second draw has a smaller sample space and changed counts.',
      'For a weighted average, add the contributions and divide by total weight. Check whether your result lies between the smallest and largest values when all weights are positive.',
    ],
    example:
      'A cyclist rides 30 km at 15 km/h and returns 30 km at 30 km/h. The trip takes 2 + 1 = 3 hours for 60 km, giving 20 km/h overall. The arithmetic mean of the two speeds would give 22.5 km/h and ignores the unequal travel times.',
    questions: [
      'What is constant in the problem: time, distance, or rate?',
      'Does the second event change the sample space?',
      'Can you solve with units before inserting numbers?',
    ],
    practice:
      'Take the quiz in 10 minutes, writing units and sample spaces. On review, identify whether each wrong answer came from a model error or arithmetic. Create one variant with a changed assumption.',
    checkpoints: [
      'Used total amount divided by total time',
      'Declared replacement assumptions',
      'Distinguished arithmetic from model errors',
    ],
    resources: [sources.probability, sources.percent],
    quiz: [
      {
        id: 'rates-1',
        prompt:
          'A completes a job in 6 hours and B in 3 hours. At constant independent rates, how long do they take together?',
        options: ['2 hours', '3 hours', '4.5 hours', '9 hours'],
        answer: 0,
        explanation:
          'Their combined rate is 1/6 + 1/3 = 1/2 job per hour, so one job takes 2 hours.',
      },
      {
        id: 'rates-2',
        prompt: 'Equal distances are travelled at 40 km/h and 60 km/h. What is the average speed?',
        options: ['50 km/h', '48 km/h', '52 km/h', '45 km/h'],
        answer: 1,
        explanation:
          'Choose 120 km each way: total distance is 240 km and total time is 3 + 2 = 5 hours. Average speed is 48 km/h.',
      },
      {
        id: 'rates-3',
        prompt:
          'A bag contains 3 red and 2 blue balls. Two balls are drawn without replacement. What is the probability both are red?',
        options: ['9/25', '3/5', '3/10', '1/5'],
        answer: 2,
        explanation:
          'P(first red) = 3/5 and P(second red given first red) = 2/4. Multiply to get 6/20 = 3/10.',
      },
      {
        id: 'rates-4',
        prompt:
          'Two groups have 10 people with average score 60 and 30 people with average score 80. What is the combined average?',
        options: ['70', '75', '80', '65'],
        answer: 1,
        explanation:
          'The total score is 10 × 60 + 30 × 80 = 3000 over 40 people. The average is 75, not the unweighted mean of 60 and 80.',
      },
    ],
  },
  {
    id: 'prep-apt-logic',
    subject: 'aptitude',
    title: 'Logical reasoning: implications and constrained ordering',
    summary: 'Distinguish what must be true from what could be true.',
    minutes: 20,
    level: 'Foundation',
    prerequisites: [],
    roles: allRoles,
    concept: 'A valid conclusion holds in every arrangement that satisfies the premises.',
    explanation: [
      'Translate “if P then Q” into a one-way implication. Observing Q does not establish P. To refute an implication, look for a case where P is true and Q is false.',
      'For ordering puzzles, record only the stated constraints. List admissible small arrangements or draw precedence arrows, then test each proposed conclusion against all admissible cases.',
      'Avoid importing everyday assumptions into a formal problem. “All A are B” alone does not establish that any A exist. Explicit words such as some, exactly, at least, and only matter.',
    ],
    example:
      'If a build is released, it passed tests. A build that passed tests may still be waiting for approval, so passing tests does not prove release. A released build that failed tests would contradict the premise.',
    questions: [
      'Can you construct a counterexample to the claimed conclusion?',
      'Did you assume an ordering that was never stated?',
      'Is existence stated explicitly or merely suggested by the wording?',
    ],
    practice:
      'Spend 7 minutes answering the quiz. For each answer, write either a proof using the premises or a counterexample for a tempting wrong option. Avoid relying on what feels likely.',
    checkpoints: [
      'Separated necessity from possibility',
      'Checked converse implications',
      'Used a counterexample',
    ],
    resources: [sources.logic],
    quiz: [
      {
        id: 'logic-1',
        prompt: 'Every approved change has a review. Change X has a review. What must follow?',
        options: [
          'X is approved',
          'X is rejected',
          'X may or may not be approved',
          'No approved change exists',
        ],
        answer: 2,
        explanation:
          'Approval implies review, but review does not imply approval. Both an approved reviewed change and an unapproved reviewed change satisfy the premise.',
      },
      {
        id: 'logic-2',
        prompt:
          'A, B, and C each run once. A runs before B, and C runs before B. Which statement must be true?',
        options: ['A runs first', 'C runs first', 'B runs last', 'A runs before C'],
        answer: 2,
        explanation:
          'The valid orders are A-C-B and C-A-B. B is last in both; A and C can exchange positions.',
      },
      {
        id: 'logic-3',
        prompt: 'All mentors are graduates. Some mentors are volunteers. What necessarily follows?',
        options: [
          'All graduates volunteer',
          'Some volunteers are graduates',
          'No volunteer is a graduate',
          'All volunteers are mentors',
        ],
        answer: 1,
        explanation:
          'The explicitly existing mentors who volunteer are graduates because all mentors are graduates. Thus at least some volunteers are graduates.',
      },
    ],
  },
  {
    id: 'prep-apt-verbal',
    subject: 'aptitude',
    title: 'Verbal reasoning: evidence, scope, and concise writing',
    summary: 'Read exactly what a passage supports and communicate the same meaning clearly.',
    minutes: 20,
    level: 'Foundation',
    prerequisites: [],
    roles: allRoles,
    concept: 'A good interpretation preserves the passage’s scope, certainty, and causal claims.',
    explanation: [
      'Separate a direct statement from an inference. Words such as some, may, and during the trial constrain the claim; replacing them with all, will, or always makes a stronger claim that needs more evidence.',
      'Two events changing together does not by itself show that one caused the other. Look for alternative explanations, comparison groups, and whether the passage claims causality at all.',
      'For concise writing, keep the actor, action, and necessary qualification. Remove repetition without deleting a condition or changing who is responsible.',
    ],
    example:
      '“In a pilot with 12 volunteers, median search time fell.” This supports a reduction in the pilot’s median time. It does not establish that every volunteer improved or that the result will hold for every future user.',
    questions: [
      'Which word limits the author’s claim?',
      'Does the conclusion introduce a cause absent from the evidence?',
      'Can you shorten the sentence while keeping its conditions?',
    ],
    practice:
      'Use 6 minutes for the quiz. Then summarize a technical paragraph in two sentences: one for its claim, one for its limitation. Review an incorrect option by identifying the unsupported word.',
    checkpoints: [
      'Preserved the passage’s scope',
      'Distinguished correlation from cause',
      'Edited without losing a condition',
    ],
    resources: [sources.concision],
    quiz: [
      {
        id: 'verbal-1',
        prompt:
          'Passage: “Some trainees used the optional tutorial. All users of the tutorial completed the exercise.” Which conclusion is supported?',
        options: [
          'All trainees completed the exercise',
          'No trainee skipped the tutorial',
          'Some trainees completed the exercise',
          'Only tutorial users completed the exercise',
        ],
        answer: 2,
        explanation:
          'At least some trainees used the tutorial and therefore completed the exercise. The passage says nothing about the completion of trainees who did not use it.',
      },
      {
        id: 'verbal-2',
        prompt:
          'Choose the clearest equivalent of: “In the event that the test fails, it is necessary for the developer to examine the log.”',
        options: [
          'The developer must always examine the log.',
          'If the test fails, the developer must examine the log.',
          'The test fails because the developer examines the log.',
          'The developer may ignore failed tests.',
        ],
        answer: 1,
        explanation:
          'The second option preserves both the failure condition and the requirement to examine the log while removing extra wording.',
      },
      {
        id: 'verbal-3',
        prompt:
          'A team releases a new tool and its defect rate falls in the same month. No other evidence is given. Which statement is best supported?',
        options: [
          'The tool caused the entire reduction.',
          'The tool cannot affect defects.',
          'The events coincided; causation is not established.',
          'Every developer made fewer mistakes.',
        ],
        answer: 2,
        explanation:
          'Timing alone does not rule out staffing, workload, measurement changes, or other explanations. A causal claim requires additional evidence.',
      },
    ],
  },
  {
    id: 'prep-interview-technical',
    subject: 'interviews',
    title: 'Technical interview: make your reasoning inspectable',
    summary: 'Practice clarification, tradeoffs, testing, and recovery when stuck.',
    minutes: 30,
    level: 'Interview',
    prerequisites: ['prep-dsa-deliberate'],
    roles: engineering,
    concept:
      'The interviewer needs enough reasoning to assess your choices, including the assumptions and limitations.',
    explanation: [
      'Start by checking the contract and constraints. Describe a correct baseline and one concrete reason it may be inadequate before proposing an optimization. Ask for missing requirements instead of silently guessing.',
      'Explain decisions at meaningful checkpoints rather than narrating every keystroke. State an invariant, why an operation preserves it, and what test might disprove your idea.',
      'If stuck, name the precise obstacle and show a small example. Separate “I know,” “I suspect,” and “I would verify.” After a hint, explain how you applied it and record the attempt as assisted.',
    ],
    example:
      'For a request to fetch the “latest” record, clarify whether latest means creation time or update time, whether ties are possible, and what should happen when no record exists. These choices affect the contract before the implementation begins.',
    questions: [
      'Which ambiguity would you clarify first?',
      'How would you communicate a correct but slow baseline?',
      'What would you say after realizing your first idea is wrong?',
    ],
    practice:
      'Use a fresh practice problem for a 20-minute spoken attempt, then 10 minutes of self-review. Write down one assumption, one tradeoff, one failed test, and any help received. Use a peer if available; no recording or upload is required.',
    checkpoints: [
      'Clarified the contract',
      'Explained one choice with evidence',
      'Reviewed testing and help honestly',
    ],
    resources: [sources.technical],
  },
  {
    id: 'prep-interview-behavior',
    subject: 'interviews',
    title: 'HR and behavioral interviews: truthful evidence',
    summary: 'Build concise examples for collaboration, failure, motivation, and growth.',
    minutes: 25,
    level: 'Interview',
    prerequisites: [],
    roles: allRoles,
    concept:
      'A credible behavioral answer connects a real situation to your own actions, an observable result, and a lesson.',
    explanation: [
      'Use situation, task, action, and result as a checklist. Keep the background short enough that your decisions receive most of the answer. Distinguish your contribution from the team’s contribution.',
      'Choose honest examples from coursework, clubs, employment, or personal projects. If you have no numerical result, describe an observable outcome rather than inventing impact metrics.',
      'For motivation questions, connect the role’s actual responsibilities with evidence from your experience. For conflict or failure, explain what you learned and changed without blaming others or pretending the result was perfect.',
    ],
    example:
      'Original practice scenario: a team’s demo failed because integration started too late. A useful answer identifies the integration decision you owned, how you helped diagnose it, what actually worked by the deadline, and the earlier integration checkpoint you used next time.',
    questions: [
      'Tell me about a disagreement where your view changed.',
      'Describe a commitment you missed and how you responded.',
      'Why does this role fit the work you want to do?',
    ],
    practice:
      'Draft three truthful examples: teamwork, a mistake, and learning something unfamiliar. Rehearse one in two minutes. Ask a peer to identify your individual action and what changed; revise if either is unclear. These are original practice prompts, not reported company questions.',
    checkpoints: [
      'Used a real event',
      'Separated personal and team actions',
      'Included a result and a subsequent change',
    ],
    resources: [sources.star, sources.interviews],
  },
  {
    id: 'prep-interview-project',
    subject: 'interviews',
    title: 'Project discussion: trace one feature end to end',
    summary:
      'Explain ownership, architecture, failures, and tradeoffs using a project you actually built.',
    minutes: 30,
    level: 'Interview',
    prerequisites: [],
    roles: allRoles,
    concept:
      'Depth comes from explaining why a design behaves as it does under normal and failing conditions.',
    explanation: [
      'Begin with the user problem, the feature you owned, and its boundaries. Draw the path from input through validation, computation, storage, and response. Name dependencies and trust boundaries.',
      'Discuss a decision in terms of alternatives and constraints. Include one failure mode, how it appears to the user, and how you detect or recover from it. A diagram without behavior does not demonstrate understanding.',
      'Distinguish measured results from estimates and future plans. Use only code and design details you are entitled to share; public or personal examples are enough for practice.',
    ],
    example:
      'For a personal notes app, trace Save: validate text, persist it, acknowledge success, and reload it. If the browser closes before persistence completes, explain whether the UI showed a premature success and what recovery evidence exists. “We use local storage” alone leaves these questions unanswered.',
    questions: [
      'Which component did you personally implement?',
      'What fails if this dependency is unavailable?',
      'Which tradeoff would change at ten times the usage?',
    ],
    practice:
      'Draw one end-to-end feature in 10 minutes. Spend 10 minutes explaining it and 10 answering the three questions. Save a short reflection with one measured fact, one untested assumption, and the next experiment you would run.',
    checkpoints: [
      'Traced data across component boundaries',
      'Explained ownership and a failure mode',
      'Separated measurements from assumptions',
    ],
    resources: [sources.technical],
  },
  {
    id: 'prep-interview-resume',
    subject: 'interviews',
    title: 'Resume preparation: claims you can defend',
    summary: 'Turn real work into relevant, specific evidence without inflated claims.',
    minutes: 25,
    level: 'Foundation',
    prerequisites: [],
    roles: allRoles,
    concept:
      'Each resume claim should help a reader understand what you did and give you something concrete to discuss.',
    explanation: [
      'Start from the responsibilities in an actual job description. Select the experiences that show relevant skills and write a clear action, scope, and outcome for each. A class project is valid evidence when described accurately.',
      'Quantify only when you can explain how the number was obtained. Distinguish a local benchmark from production usage, simulated data from real customers, and your contribution from a team result.',
      'Review links, dates, consistency, and readability after exporting the resume. Keep private contact details in your own document; the preparation reflection needs only the changes you plan to make.',
    ],
    example:
      '“Built a task API with input validation and 18 automated endpoint tests” is a defensible original example if those tests exist. “Improved performance by 80%” is not defensible without a baseline, workload, measurement method, and evidence.',
    questions: [
      'What would you show if asked to substantiate this bullet?',
      'Does the claimed skill appear in work you can explain?',
      'Which word overstates the scale or your ownership?',
    ],
    practice:
      'Pick three bullets from your resume. For each, identify the action, scope, and evidence. Rewrite one vague bullet, test every public project link, and prepare a 60-second explanation of the strongest claim.',
    checkpoints: [
      'Matched evidence to the role',
      'Removed unsupported metrics',
      'Checked links and practiced one claim',
    ],
    resources: [sources.resume],
  },
  {
    id: 'prep-interview-mock',
    subject: 'interviews',
    title: 'Mock interview: rehearse, assess, and revise',
    summary: 'Run a structured mock with an explicit feedback rubric.',
    minutes: 40,
    level: 'Interview',
    prerequisites: ['prep-interview-behavior', 'prep-interview-project'],
    roles: allRoles,
    concept:
      'A mock is useful when feedback identifies a specific behavior to change and the next practice tests that change.',
    explanation: [
      'Agree on the role and format before starting. Use 5 minutes for an introduction, 15 for a role-relevant technical or analytical prompt, 10 for a project or behavioral discussion, and 10 for feedback.',
      'Assess clarity of assumptions, correctness of reasoning, evidence from examples, and response to uncertainty. Score each as demonstrated, partly demonstrated, or needs practice; avoid pretending this predicts a hiring outcome.',
      'Save one strength, one missed opportunity, and a follow-up exercise. Record whether the interviewer supplied hints. On the next mock, focus on the previous weakness while changing the prompt.',
    ],
    example:
      'Feedback such as “You said the database was slow but did not explain what you measured” leads to a concrete exercise: prepare a two-minute diagnosis with one observed metric and two alternative explanations. “Be more confident” alone does not specify a skill to practice.',
    questions: [
      'Which statement in your answer lacked evidence?',
      'Did you clarify what success meant before proposing a solution?',
      'What will the next mock test differently?',
    ],
    practice:
      'Run the 40-minute format with a peer, or speak answers aloud and self-assess. Engineering roles can use a fresh DSA or design prompt; analyst roles can use a data-quality or metrics prompt. Write the rubric feedback in your reflection. This is a manual mock, not an AI interviewer.',
    checkpoints: [
      'Completed the agreed time blocks',
      'Assessed evidence and assistance',
      'Chose one targeted follow-up exercise',
    ],
    resources: [sources.interviews, sources.technical],
  },
  {
    id: 'prep-company-software',
    subject: 'company',
    title: 'Software roles: build an evidence-based placement roadmap',
    summary:
      'Prepare coding and behavioral rounds using official guidance and your actual invitation.',
    minutes: 25,
    level: 'Interview',
    prerequisites: ['prep-dsa-deliberate', 'prep-interview-resume'],
    roles: ['software', 'fullstack'],
    concept:
      'A role roadmap starts with verified responsibilities and process information, then assigns practice to the skills it actually requires.',
    explanation: [
      'Read the official role description and employer preparation page. Record confirmed assessment categories separately from questions you still need to ask the recruiter. Round order, timing, and permitted tools can vary by role and location.',
      'For a general software plan, pair continued DSA practice with testing and debugging, one core-CS topic, one project explanation, and a behavioral example. Adjust the emphasis using evidence from your recent attempts.',
      'The linked Amazon university SDE and Microsoft technical pages are official preparation resources. The roadmap and questions here are original preparation exercises, not claims that either employer asked these questions or guarantees of a specific hiring process.',
    ],
    example:
      'If a role description mentions service development and your last two mock attempts failed on testing, allocate the next study block to boundary cases and debugging. Keep the existing Striver queue, then schedule a separate project walkthrough. Do not replace a documented weakness with an unverified “most asked” list.',
    questions: [
      'Which skills are explicit in the role description?',
      'Which parts of the hiring format remain unconfirmed?',
      'What evidence determines your next study block?',
    ],
    practice:
      'Choose one real open role. In your reflection, record the official role URL, confirmed round categories, three relevant skills, and your weakest skill with evidence. Use your profile goal and weak-subject settings to guide the planner. Recheck the actual invitation before an assessment.',
    checkpoints: [
      'Used official role and process information',
      'Separated facts from assumptions',
      'Mapped weaknesses to practice',
    ],
    resources: [sources.amazonSde, sources.technical],
  },
  {
    id: 'prep-company-backend',
    subject: 'company',
    title: 'Backend and full-stack roles: prepare across boundaries',
    summary: 'Connect coding, data, networks, design, and project ownership.',
    minutes: 30,
    level: 'Interview',
    prerequisites: ['prep-interview-project', 'prep-interview-technical'],
    roles: ['backend', 'fullstack'],
    concept:
      'Role preparation should show how several fundamentals work together in one concrete feature.',
    explanation: [
      'Use an actual job description to determine the required stack and responsibilities. A backend plan may emphasize data modeling, APIs, concurrency, reliability, and testing; a full-stack plan also needs user flows, browser behavior, and accessibility where relevant.',
      'Trace a request through the system and identify the owner of each decision. Practice explaining validation, authorization, persistence, duplicate requests, failure reporting, and observable performance without assuming a particular framework solves them automatically.',
      'Microsoft’s technical guidance is an official example of preparation across problem solving, design, coding, and testing. This lesson is an original role-based exercise, not a Microsoft-specific question bank or a statement that every placement includes system design.',
    ],
    example:
      'For an original booking feature, consider what happens when a user presses Confirm twice, the network times out after saving, or two users request the last available seat. These scenarios expose boundaries between UI feedback, request handling, and storage correctness without prescribing a particular design.',
    questions: [
      'Which layer owns each requirement?',
      'What does the user see after a partial failure?',
      'Which assumption would you validate before scaling?',
    ],
    practice:
      'Choose a real backend or full-stack listing. Match each essential responsibility to a project example or a specific study gap. Sketch a booking or task-management request flow and discuss two failure cases. Schedule the weakest relevant CS or design topic next.',
    checkpoints: [
      'Mapped the actual role to study topics',
      'Explained request and failure paths',
      'Identified a testable gap',
    ],
    resources: [sources.technical, sources.interviews],
  },
  {
    id: 'prep-company-analyst',
    subject: 'company',
    title: 'Analyst roles: SQL, metrics, and business reasoning',
    summary:
      'Prepare analytical explanations grounded in data quality and explicit metric definitions.',
    minutes: 30,
    level: 'Interview',
    prerequisites: ['prep-apt-rates', 'prep-interview-project'],
    roles: ['analyst'],
    concept:
      'An analytical recommendation is only as strong as its metric definition, data quality, and uncertainty handling.',
    explanation: [
      'Read the role description before choosing a curriculum. Analyst, business intelligence, and data engineering roles overlap but can require different levels of SQL, statistics, visualization, and data modeling.',
      'For each business question, define the population, unit of analysis, time window, numerator, and denominator. Check duplicate records, missing data, and whether joining tables changes the number of rows.',
      'Amazon’s BIE preparation page is a verified official resource for that role. It is useful evidence about BIE preparation, not a universal process for all analyst jobs. Our exercises are original and are not attributed to an employer.',
    ],
    example:
      'An original dashboard shows orders increasing while conversion falls. Both can be true if visits grow faster than orders. Before recommending a change, define whether conversion uses visits, users, or sessions, and check whether a tracking change altered the denominator.',
    questions: [
      'What is the unit of analysis and why?',
      'Could a join duplicate your numerator?',
      'Which alternative explanation would change your recommendation?',
    ],
    practice:
      'Choose one analyst or BIE role. Map its requirements to SQL, DBMS, quantitative reasoning, and communication. Draft a response to the conversion scenario with a metric definition, two quality checks, and one uncertainty. Add the weakest subject to your profile.',
    checkpoints: [
      'Verified role-specific expectations',
      'Defined metrics and data-quality checks',
      'Communicated an uncertainty and next step',
    ],
    resources: [sources.amazonBie, sources.probability],
  },
];
