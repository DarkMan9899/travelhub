import { describe, test, expect } from '@jest/globals';
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractFeatureCode,
  extractContext,
  GROUNDING_CLAUSE,
} from '../../../../src/modules/ai/prompts/promptGrounding.js';

describe('promptGrounding', () => {
  test('buildSystemPrompt tags the feature code and includes the grounding clause', () => {
    const system = buildSystemPrompt('trip_planner', 'You plan trips.');
    expect(system).toContain('[[ai-feature:trip_planner]]');
    expect(system).toContain('You plan trips.');
    expect(system).toContain(GROUNDING_CLAUSE);
  });

  test('buildUserPrompt embeds the context as a fenced JSON block', () => {
    const user = buildUserPrompt('Plan a trip.', { destination: 'Yerevan' });
    expect(user).toContain('Plan a trip.');
    expect(user).toContain('```json');
    expect(extractContext(user)).toEqual({ destination: 'Yerevan' });
  });

  test('extractFeatureCode round-trips what buildSystemPrompt wrote', () => {
    const system = buildSystemPrompt('assistant', 'Answer questions.');
    expect(extractFeatureCode(system)).toBe('assistant');
  });

  test('extractFeatureCode returns null for an untagged system prompt', () => {
    expect(extractFeatureCode('just a plain instruction')).toBeNull();
  });

  test('extractContext returns {} for a missing or malformed block', () => {
    expect(extractContext('no context here')).toEqual({});
    expect(extractContext('```json\nnot valid json\n```')).toEqual({});
  });
});
