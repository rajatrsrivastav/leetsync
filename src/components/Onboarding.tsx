import { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { AppState } from '../types';
import type { Command } from '../services/commands';
import { Brand } from './ui';
export const languages = [
  ['python3', 'Python'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['java', 'Java'],
  ['cpp', 'C++'],
  ['c', 'C'],
  ['csharp', 'C#'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['kotlin', 'Kotlin'],
  ['swift', 'Swift'],
  ['ruby', 'Ruby'],
] as const;
export function LanguageSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {languages.map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  );
}
export function Onboarding({
  state,
  act,
  busy,
}: {
  state: AppState;
  act: (c: Command) => Promise<AppState | undefined>;
  busy: boolean;
}) {
  const [goal, setGoal] = useState(2),
    [language, setLanguage] = useState('python3');
  return (
    <div className="onboarding">
      <Brand />
      <div className="onboarding-symbol">
        <CheckCircle2 size={40} />
      </div>
      <span className="eyebrow">SMALL STEPS. REAL PROGRESS.</span>
      <h1>
        Your daily two.
        <br />
        <span className="text-accent">Your next chapter.</span>
      </h1>
      <p className="intro">
        Build coding consistency with Striver, then track CS, system design, aptitude, and interview
        practice in your campus preparation dashboard.
      </p>
      <div className="stack">
        <label>
          Daily DSA target
          <input
            type="number"
            min={1}
            max={20}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
        </label>
        <label>
          Curriculum
          <select disabled>
            <option>Striver 180 · 179 problems</option>
          </select>
        </label>
        <label>
          Primary language
          <LanguageSelect value={language} onChange={setLanguage} />
        </label>
      </div>
      <button
        className="button primary"
        disabled={busy || goal < 1 || goal > 20 || !Number.isInteger(goal)}
        onClick={() =>
          void act({
            type: 'settings',
            settings: {
              ...state.settings,
              onboardingComplete: true,
              dailyGoal: goal,
              primaryLanguage: language,
            },
          })
        }
      >
        Start Journey
        <ArrowRight size={18} />
      </button>
      <p className="privacy-note">
        <ShieldCheck size={15} />
        Local-first. No account needed.
        <br />
        Connect GitHub whenever you’re ready.
      </p>
    </div>
  );
}
