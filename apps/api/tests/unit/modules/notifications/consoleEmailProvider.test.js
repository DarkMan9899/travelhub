import { describe, test, expect } from '@jest/globals';
import { ConsoleEmailProvider } from '../../../../src/modules/notifications/channels/consoleEmailProvider.js';

describe('ConsoleEmailProvider', () => {
  test('reports a delivered result without contacting any external service', async () => {
    const provider = new ConsoleEmailProvider();
    const result = await provider.send(
      { subject: 'Hi', body: 'Body text' },
      'traveler@example.com',
    );
    expect(result).toEqual({ delivered: true, provider: 'console' });
  });
});
