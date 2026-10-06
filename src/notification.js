function showReminderNotification(NotificationClass, config) {
  if (!NotificationClass || !config || config.enabled === false) return false;
  if (typeof NotificationClass.isSupported === 'function' && !NotificationClass.isSupported()) {
    return false;
  }
  const title = String(config.title || 'FocusBuddy').slice(0, 80);
  const body = String(config.body || 'Take a short break.').slice(0, 180);
  try {
    const note = new NotificationClass({ title, body, silent: true });
    note.show();
    return true;
  } catch (error) {
    console.error('Notification failed', error.message);
    return false;
  }
}

module.exports = { showReminderNotification };
