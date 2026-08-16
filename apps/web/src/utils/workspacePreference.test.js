import { describe, test, expect, beforeEach } from 'vitest';
import { getLastWorkspace, setLastWorkspace } from './workspacePreference.js';

describe('workspacePreference (apps/web/src/utils)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('returns null when nothing has been stored', () => {
    expect(getLastWorkspace()).toBeNull();
  });

  test('round-trips a valid workspace value', () => {
    setLastWorkspace('partner');
    expect(getLastWorkspace()).toBe('partner');
  });

  test('ignores an invalid stored value', () => {
    window.localStorage.setItem('travelhub:lastWorkspace', 'admin');
    expect(getLastWorkspace()).toBeNull();
  });

  test('ignores an attempt to store an invalid workspace value', () => {
    setLastWorkspace('customer');
    setLastWorkspace('not-a-real-workspace');
    expect(getLastWorkspace()).toBe('customer');
  });
});
