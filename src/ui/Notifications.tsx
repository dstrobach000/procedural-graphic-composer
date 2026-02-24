import { useProjectStore } from '../store/useProjectStore';

export function Notifications() {
  const notifications = useProjectStore((state) => state.notifications);
  const dismissNotification = useProjectStore((state) => state.dismissNotification);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <section className="notifications">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={notification.level === 'error' ? 'notification error' : 'notification info'}
        >
          <span>{notification.message}</span>
          <button type="button" onClick={() => dismissNotification(notification.id)}>
            x
          </button>
        </div>
      ))}
    </section>
  );
}
