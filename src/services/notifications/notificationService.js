export const notificationServiceContract = {
  channels: ['email', 'sms', 'push', 'whatsapp', 'internal'],
  operations: [
    'sendNotification',
    'scheduleNotification',
    'cancelNotification',
    'getNotificationStatus',
  ],
};

export const notificationService = {
  getContract() {
    return notificationServiceContract;
  },
};
