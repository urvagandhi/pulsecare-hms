import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE, HOSPITAL_NAME } from '../lib/brand';

describe('Frontend Core Utilities & Brand Config', () => {
  it('merges Tailwind CSS classes without conflict using clsx + twMerge', () => {
    expect(cn('px-2 py-1', 'bg-blue-500')).toBe('px-2 py-1 bg-blue-500');
    expect(cn('p-4', 'p-2')).toBe('p-2'); // Tailwind merge resolves conflicts
    expect(cn('text-red-500', undefined, null, false && 'text-blue-500')).toBe('text-red-500');
  });

  it('exposes valid hospital brand metadata', () => {
    expect(APP_NAME).toBe('PulseCare HMS');
    expect(APP_SHORT_NAME).toBe('PulseCare');
    expect(APP_TAGLINE).toBeDefined();
    expect(APP_TAGLINE.length).toBeGreaterThan(0);
    expect(HOSPITAL_NAME).toBe('PulseCare Multi-Speciality Hospital');
  });
});
