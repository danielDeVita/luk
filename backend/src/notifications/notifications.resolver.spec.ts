import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';
import { UserRole, MpConnectStatus, KycStatus } from '@prisma/client';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;
  let notificationsService: any;
  let pubSub: any;

  const mockNotificationsService = {
    findAll: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  };

  const mockPubSub = {
    asyncIterableIterator: jest.fn(),
  };

  const createTestUser = (overrides = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    nombre: 'Test',
    apellido: 'User',
    role: UserRole.USER,
    emailVerified: true,
    twoFactorEnabled: false,
    twoFactorEnabledAt: null,
    mpConnectStatus: MpConnectStatus.NOT_CONNECTED,
    kycStatus: KycStatus.NOT_SUBMITTED,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    ...overrides,
  });

  const createTestNotification = (overrides = {}) => ({
    id: 'notif-1',
    userId: 'user-1',
    type: 'INFO',
    title: 'Test Notification',
    message: 'This is a test',
    read: false,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsResolver,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: 'PUB_SUB', useValue: mockPubSub },
      ],
    }).compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
    notificationsService = module.get(NotificationsService);
    pubSub = module.get('PUB_SUB');
  });

  describe('myNotifications', () => {
    it('should return all notifications for current user', async () => {
      const user = createTestUser();
      const notifications = [
        createTestNotification({ id: 'notif-1', read: false }),
        createTestNotification({ id: 'notif-2', read: true }),
        createTestNotification({ id: 'notif-3', read: false }),
      ];

      notificationsService.findAll.mockResolvedValue(notifications);

      const result = await resolver.myNotifications(user);

      expect(result).toEqual(notifications);
      expect(result).toHaveLength(3);
      expect(notificationsService.findAll).toHaveBeenCalledWith(user.id);
    });

    it('should return empty array when user has no notifications', async () => {
      const user = createTestUser();

      notificationsService.findAll.mockResolvedValue([]);

      const result = await resolver.myNotifications(user);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should call service with correct user ID', async () => {
      const user = createTestUser({ id: 'custom-user-id' });

      notificationsService.findAll.mockResolvedValue([]);

      await resolver.myNotifications(user);

      expect(notificationsService.findAll).toHaveBeenCalledWith(
        'custom-user-id',
      );
    });
  });

  describe('markNotificationRead', () => {
    it('should mark notification as read', async () => {
      const user = createTestUser();
      const notificationId = 'notif-1';
      const updatedNotification = createTestNotification({
        id: notificationId,
        read: true,
      });

      notificationsService.markAsRead.mockResolvedValue(updatedNotification);

      const result = await resolver.markNotificationRead(user, notificationId);

      expect(result).toEqual(updatedNotification);
      expect(result.read).toBe(true);
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        user.id,
      );
    });

    it('should call service with correct notification ID', async () => {
      const user = createTestUser({ id: 'specific-user-id' });
      const notificationId = 'specific-notif-id';

      notificationsService.markAsRead.mockResolvedValue(
        createTestNotification({ id: notificationId }),
      );

      await resolver.markNotificationRead(user, notificationId);

      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        'specific-notif-id',
        'specific-user-id',
      );
    });
  });

  describe('markAllNotificationsRead', () => {
    it('should mark all notifications as read for user', async () => {
      const user = createTestUser();

      notificationsService.markAllAsRead.mockResolvedValue(undefined);

      const result = await resolver.markAllNotificationsRead(user);

      expect(result).toBe(true);
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(user.id);
    });

    it('should always return true on success', async () => {
      const user = createTestUser();

      notificationsService.markAllAsRead.mockResolvedValue(undefined);

      const result = await resolver.markAllNotificationsRead(user);

      expect(result).toBe(true);
    });

    it('should call service with correct user ID', async () => {
      const user = createTestUser({ id: 'user-123' });

      notificationsService.markAllAsRead.mockResolvedValue(undefined);

      await resolver.markAllNotificationsRead(user);

      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('testEmail', () => {
    it('should send welcome email to user', async () => {
      const user = createTestUser({
        email: 'test@example.com',
        nombre: 'John',
      });

      notificationsService.sendWelcomeEmail.mockResolvedValue(true);

      const result = await resolver.testEmail(user);

      expect(result).toBe(true);
      expect(notificationsService.sendWelcomeEmail).toHaveBeenCalledWith(
        'test@example.com',
        { userName: 'John' },
      );
    });

    it('should use user email and nombre', async () => {
      const user = createTestUser({
        email: 'specific@example.com',
        nombre: 'Specific',
      });

      notificationsService.sendWelcomeEmail.mockResolvedValue(true);

      await resolver.testEmail(user);

      expect(notificationsService.sendWelcomeEmail).toHaveBeenCalledWith(
        'specific@example.com',
        expect.objectContaining({ userName: 'Specific' }),
      );
    });

    it('should return false when email fails', async () => {
      const user = createTestUser();

      notificationsService.sendWelcomeEmail.mockResolvedValue(false);

      const result = await resolver.testEmail(user);

      expect(result).toBe(false);
    });
  });

  describe('notificationAdded', () => {
    it('should create async iterable iterator for subscriptions', () => {
      const mockIterator = {
        [Symbol.asyncIterator]: jest.fn(),
      };

      pubSub.asyncIterableIterator.mockReturnValue(mockIterator);

      const result = resolver.notificationAdded();

      expect(result).toBe(mockIterator);
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        'notificationAdded',
      );
    });

    it('should call pubSub with correct event name', () => {
      pubSub.asyncIterableIterator.mockReturnValue({
        [Symbol.asyncIterator]: jest.fn(),
      });

      resolver.notificationAdded();

      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        'notificationAdded',
      );
    });
  });
});
