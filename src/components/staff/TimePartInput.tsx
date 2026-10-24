'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface TimePartInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  values: string[];
}

export function TimePartInput({ label, value, onChange, values }: TimePartInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="flex min-w-0 rounded-xl border border-ds-border bg-ds-dark focus-within:border-cyan-400">
        <input
          aria-label={label}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          placeholder={label.includes('hour') ? 'HH' : 'MM'}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 2))}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 bg-transparent pl-3 py-2.5 text-white outline-none"
        />
        <button
          type="button"
          aria-label={`Choose ${label.toLowerCase()}`}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="px-2 text-ds-text-muted hover:text-cyan-300"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-ds-border bg-ds-surface shadow-xl">
          {values.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => { onChange(option); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left font-mono hover:bg-cyan-500/20 ${value === option ? 'text-cyan-300' : 'text-white'}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
