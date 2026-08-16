import { describe, test, expect, jest } from '@jest/globals';
import { MessageAttachmentService } from '../../../../src/modules/messaging/services/messageAttachmentService.js';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

const PARTICIPANT = { userId: 1, roles: ['CUSTOMER'] };

function buildService(overrides = {}) {
  const messageAttachmentRepository = {
    create: jest.fn().mockResolvedValue({
      id: 5,
      url: '/uploads/messaging/1/123.png',
      mimeType: 'image/png',
      mediaTypeCode: 'IMAGE',
      fileSizeBytes: 100,
    }),
    ...overrides.messageAttachmentRepository,
  };
  const conversationService = {
    assertCanWrite: jest.fn().mockResolvedValue(undefined),
    ...overrides.conversationService,
  };
  const storageProvider = {
    put: jest.fn().mockResolvedValue({
      key: 'messaging/1/123.png',
      url: '/uploads/messaging/1/123.png',
    }),
    ...overrides.storageProvider,
  };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new MessageAttachmentService({
    messageAttachmentRepository,
    conversationService,
    storageProvider,
    eventBus,
  });
  return {
    service,
    messageAttachmentRepository,
    conversationService,
    storageProvider,
    eventBus,
  };
}

describe('MessageAttachmentService', () => {
  test('throws AuthenticationError with no principal', async () => {
    const { service } = buildService();
    await expect(
      service.uploadAttachment(null, 1, Buffer.from('x'), 'image/png'),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  test('propagates an authorization failure and never touches storage', async () => {
    const rejection = new AuthorizationError();
    const { service, storageProvider } = buildService({
      conversationService: {
        assertCanWrite: jest.fn().mockRejectedValue(rejection),
      },
    });
    await expect(
      service.uploadAttachment(PARTICIPANT, 1, Buffer.from('x'), 'image/png'),
    ).rejects.toBe(rejection);
    expect(storageProvider.put).not.toHaveBeenCalled();
  });

  test('rejects an unsupported mime type before touching storage', async () => {
    const { service, storageProvider } = buildService();
    await expect(
      service.uploadAttachment(
        PARTICIPANT,
        1,
        Buffer.from('x'),
        'application/x-executable',
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(storageProvider.put).not.toHaveBeenCalled();
  });

  test('rejects a file over the size limit before touching storage', async () => {
    const { service, storageProvider } = buildService();
    const oversized = Buffer.alloc(11 * 1024 * 1024);
    await expect(
      service.uploadAttachment(PARTICIPANT, 1, oversized, 'image/png'),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(storageProvider.put).not.toHaveBeenCalled();
  });

  test('stores the file, persists the media row, and publishes ATTACHMENT_UPLOADED', async () => {
    const { service, storageProvider, messageAttachmentRepository, eventBus } =
      buildService();
    const buffer = Buffer.from('fake-image-bytes');
    const media = await service.uploadAttachment(
      PARTICIPANT,
      1,
      buffer,
      'image/png',
    );

    expect(storageProvider.put).toHaveBeenCalledWith(
      expect.stringMatching(/^messaging\/1\/\d+-1\.png$/),
      buffer,
      { contentType: 'image/png' },
    );
    expect(messageAttachmentRepository.create).toHaveBeenCalledWith({
      conversationId: 1,
      mediaTypeCode: 'IMAGE',
      url: '/uploads/messaging/1/123.png',
      mimeType: 'image/png',
      fileSizeBytes: buffer.length,
      ownerUserId: 1,
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'attachment.uploaded',
        payload: expect.objectContaining({ conversationId: 1, mediaId: 5 }),
      }),
    );
    expect(media.id).toBe(5);
  });
});
