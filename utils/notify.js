const Notification = require('../models/Notification');
const { sendPush } = require('./pushService');
const { runInBackground } = require('./background');

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
  // Awaited (never throws — runInBackground swallows and logs) so that notifyUser's
  // own promise covers the push. Otherwise the caller's waitUntil would settle while
  // the push was still in flight, and the lambda would freeze on top of it.
  await runInBackground(() => sendPush(userId, { title, body: message, url: pushUrl(link), tag: type }), 'web push');
  return notification;
}

module.exports = { notifyUser };
