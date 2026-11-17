import { Check, X } from 'lucide-react';
import React from 'react';

interface PasswordRequirementsProps {
  password?: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password = '' }) => {
  const rules = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'One number (0-9)', valid: /\d/.test(password) },
    {
      label: 'One special symbol (!@#$%^&* etc.)',
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-muted p-3 text-xs">
      <p id="password-requirements-title" className="font-semibold text-foreground">
        Password requirements:
      </p>
      <ul
        aria-labelledby="password-requirements-title"
        aria-live="polite"
        className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2"
      >
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 transition-colors ${
              rule.valid ? 'font-medium text-success' : 'text-muted-foreground'
            }`}
          >
            {rule.valid ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{rule.label}</span>
            <span className="sr-only">{rule.valid ? '(met)' : '(not met)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
