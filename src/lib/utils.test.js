import { beforeAll, describe, expect, it } from 'vitest';

// utils.js reads window at import (isIframe); the suite runs in node.
let cn;
beforeAll(async () => {
  globalThis.window ??= globalThis;
  ({ cn } = await import('./utils'));
});

describe('cn', () => {
  // The header actions pass rounded-control to the shared Button, which
  // carries rounded-md itself. Both used to survive, and .rounded-md (later
  // in the stylesheet) won, so Noir's Scan buttons stayed square.
  it('lets rounded-control replace a component radius', () => {
    expect(cn('rounded-md h-11', 'rounded-control')).toBe('h-11 rounded-control');
  });

  it('still merges the standard radius steps', () => {
    expect(cn('rounded-md', 'rounded-lg')).toBe('rounded-lg');
  });
});
