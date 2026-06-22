const Notification = require('../models/Notification');
const { sendPush } = require('./pushService');

// Push deep-links target the customer app routes; the stored notification keeps
// the existing '/orders' / '/bookings' convention for backward compatibility.
function pushUrl(link) {
  if (!link) return '/';
  if (link.startsWith('/orders')) return link.replace('/orders', '/account/orders');
  if (link.startsWith('/bookings')) return link.replace('/bookings', '/account/bookings');
  return link;
}

// Create an in-app notification AND fire a Web Push (best-effort) in one call.
async function notifyUser(userId, { type = 'system', title, message, link = '' }) {
  if (!userId || !title || !message) return null;
  let notification = null;
  try {
    notification = await Notification.create({ user: userId, type, title, message, link });
  } catch (e) {
    console.error('notifyUser: failed to create notification:', e.message);
  }
  sendPush(userId, { title, body: message, url: pushUrl(link), tag: type }).catch(() => {});
  return notification;
}

module.exports = { notifyUser };
