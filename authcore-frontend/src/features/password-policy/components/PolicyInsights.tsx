import { CheckCircle2, Circle, Lightbulb, RefreshCw, ShieldCheck } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { PasswordPolicyRules } from '../types/password-policy.types';
import { examplePassword, policyStrength, ruleSentences, testPassword } from './policy-rules';
import { StrengthGauge } from './PolicyControls';

function AsideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-md border border-border bg-surface p-card">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** The gauge plus what would make the policy stronger. */
export function StrengthCard({ rules }: { rules: PasswordPolicyRules }) {
  const strength = policyStrength(rules);
  return (
    <AsideCard title="Policy strength">
      <div className="flex justify-center">
        <StrengthGauge strength={strength} />
      </div>
      {strength.tips.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {strength.tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lightbulb className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Every recommended protection is on.
        </p>
      )}
    </AsideCard>
  );
}

/** Type a password and see which of the form's rules it meets. */
export function TryPasswordCard({ rules }: { rules: PasswordPolicyRules }) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [example, setExample] = useState(() => examplePassword(rules));
  const results = testPassword(rules, password);
  const isValid = password !== '' && results.every((r) => r.isMet);

  return (
    <AsideCard title="Try a password">
      <label htmlFor={id} className="sr-only">
        Sample password
      </label>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={password}
        placeholder="Type a password to check it"
        onChange={(e) => setPassword(e.target.value)}
        className="font-mono"
      />
      <ul className="mt-3 space-y-1.5" aria-live="polite">
        {results.map((result) => (
          <li
            key={result.label}
            className={cn(
              'flex items-center gap-2 text-xs',
              result.isMet ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {result.isMet ? (
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {result.label}
            <span className="sr-only">{result.isMet ? '(met)' : '(not met)'}</span>
          </li>
        ))}
      </ul>
      {isValid && (
        <p className="mt-3 rounded-md bg-success-soft px-3 py-2 text-xs text-success-soft-foreground">
          Meets the rules above. Common, breached and personal passwords are checked when it’s
          saved.
        </p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-1.5 text-xs text-muted-foreground">An example that follows this policy</p>
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
            {example}
          </code>
          <button
            type="button"
            aria-label="Another example"
            onClick={() => setExample(examplePassword(rules))}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
          <CopyButton value={example} label="Copy the example" />
        </div>
      </div>
    </AsideCard>
  );
}

/** The policy in plain sentences, as users will read it. */
export function SummaryCard({ rules }: { rules: PasswordPolicyRules }) {
  return (
    <AsideCard title="What users will see">
      <ul className="space-y-1.5">
        {ruleSentences(rules).map((rule) => (
          <li key={rule} className="flex items-start gap-2 text-xs text-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </AsideCard>
  );
}
