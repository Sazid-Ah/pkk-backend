const nodemailer = require('nodemailer');
const { generateOrderInvoicePdf, generateBookingInvoicePdf } = require('./invoicePdf');

// ── HTTP email transport (Resend) ─────────────────────────────────────────────
// SMTP egress is unreliable/blocked on many cloud hosts (e.g. Render → CONN
// timeouts). When RESEND_API_KEY is set we send over HTTPS instead, which is
// never affected by SMTP port blocking. Exposes a nodemailer-compatible
// `sendMail(mailOptions)` so the rest of this file is unchanged.
const sendViaResend = async (opts) => {
    const attachments = (opts.attachments || []).map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
    }));
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: opts.from,
            to: opts.to,
            subject: opts.subject,
            html: opts.html,
            ...(attachments.length ? { attachments } : {}),
        }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Resend API ${res.status}: ${text}`);
    }
    const data = await res.json().catch(() => ({}));
    return { messageId: data.id };
};

// Create reusable transporter
const createTransporter = () => {
    // Prefer the HTTP API when configured.
    if (process.env.RESEND_API_KEY) {
        return { sendMail: sendViaResend };
    }
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;

    const options = {
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Render's egress to SMTP is slow to connect (not blocked) — needs a generous
        // timeout; a short one causes false ETIMEDOUT on connect.
        connectionTimeout: 30000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
    };

    if (host === 'smtp.gmail.com') {
        // Use nodemailer's built-in Gmail preset (proven to work on Render).
        Object.assign(options, { service: 'gmail', secure: true });
    } else {
        Object.assign(options, {
            host,
            port,
            // 465 = implicit TLS; 587/25 = STARTTLS. Derived when SMTP_SECURE unset.
            secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465,
        });
    }

    // IPv4 is opt-in (the working reference project does NOT force it).
    if (process.env.SMTP_FORCE_IPV4 === 'true') options.family = 4;

    return nodemailer.createTransport(options);
};

// Single shared transporter (reused across all emails). With pool:true a new
// transporter per-send would leak connections and get throttled by Gmail.
let _transporter;
const getTransporter = () => {
    if (!_transporter) _transporter = createTransporter();
    return _transporter;
};

// Boot-time check so logs show the exact email status with the deployed env.
const verifyEmailTransport = async () => {
    if (process.env.RESEND_API_KEY) {
        console.log('📧 Email transport: Resend (HTTP API)');
        return;
    }
    const where = `SMTP ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${parseInt(process.env.SMTP_PORT, 10) || 587}`;
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.error(`❌ Email transport: missing SMTP_USER/SMTP_PASSWORD (${where})`);
        return;
    }
    try {
        await getTransporter().verify();
        console.log(`✅ Email transport ready (${where})`);
    } catch (e) {
        console.error(`❌ Email transport FAILED (${where}): ${e.code || ''} ${e.message}`);
    }
};

// Send OTP email
const sendOTPEmail = async (email, otp, username, subject = 'Password Reset OTP - Pandit Katha Kalyan', title = 'Password Reset Request') => {
    try {
        const transporter = getTransporter();

        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: subject,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .otp-box { background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${title}</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${username}</strong>,</p>
                            <p>Please use the following OTP (One-Time Password) to proceed:</p>
                            
                            <div class="otp-box">
                                <div class="otp-code">${otp}</div>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong> This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.
                            </div>
                            
                            <p>If you didn't request this, please ignore this email or contact support if you have concerns.</p>
                            
                            <p>Best regards,<br>Pandit Katha Kalyan Team</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('OTP email sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
};

// Send password reset confirmation email
const sendPasswordResetConfirmation = async (email, username) => {
    try {
        const transporter = getTransporter();

        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: 'Password Reset Successful - Pandit Katha Kalyan',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .info-box { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 10px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Reset Successful</h1>
                        </div>
                        <div class="content">
                            <div class="success-icon">✅</div>
                            <p>Hello <strong>${username}</strong>,</p>
                            <p>Your password has been successfully reset.</p>
                            
                            <div class="info-box">
                                <strong>ℹ️ Note:</strong> You can now log in with your new password.
                            </div>
                            
                            <p>If you didn't make this change, please contact our support team immediately to secure your account.</p>
                            
                            <p>Best regards,<br>Pandit Katha Kalyan Team</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset confirmation email sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        // Don't throw error here, as password is already reset
        return { success: false, error: error.message };
    }
};

const sendBookingCancellationEmail = async (email, username, bookingId, amount) => {
    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: 'Booking Cancellation Confirmation - Pandit Katha Kalyan',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; line-height: 1.5; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #f97316; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #fafafa; padding: 30px; border-radius: 0 0 10px 10px; }
                        .amount { font-size: 28px; font-weight: bold; color: #111827; margin: 20px 0; }
                        .footer { color: #6b7280; font-size: 13px; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header"><h1>Booking Cancelled</h1></div>
                        <div class="content">
                            <p>Hi <strong>${username}</strong>,</p>
                            <p>Your booking <strong>#${bookingId}</strong> has been cancelled successfully.</p>
                            <p class="amount">Refund Amount: ₹${amount.toFixed(2)}</p>
                            <p>If you have any questions, please contact support.</p>
                            <p>Thanks,<br>Pandit Katha Kalyan Team</p>
                        </div>
                        <div class="footer">This is an automated message. Please do not reply directly.</div>
                    </div>
                </body>
                </html>
            `,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Booking cancellation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending booking cancellation email:', error);
        return { success: false, error: error.message };
    }
};

const sendOrderCancellationEmail = async (email, username, orderId, amount) => {
    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: 'Order Cancellation Confirmation - Pandit Katha Kalyan',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; line-height: 1.5; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #2563eb; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #fafafa; padding: 30px; border-radius: 0 0 10px 10px; }
                        .amount { font-size: 28px; font-weight: bold; color: #111827; margin: 20px 0; }
                        .footer { color: #6b7280; font-size: 13px; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header"><h1>Order Cancelled</h1></div>
                        <div class="content">
                            <p>Hi <strong>${username}</strong>,</p>
                            <p>Your order <strong>#${orderId}</strong> has been cancelled successfully.</p>
                            <p class="amount">Refund Amount: ₹${amount.toFixed(2)}</p>
                            <p>If you have any questions, please contact support.</p>
                            <p>Thanks,<br>Pandit Katha Kalyan Team</p>
                        </div>
                        <div class="footer">This is an automated message. Please do not reply directly.</div>
                    </div>
                </body>
                </html>
            `,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Order cancellation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending order cancellation email:', error);
        return { success: false, error: error.message };
    }
};

const sendInquiryEmail = async ({ name, email, phone, subject, message }) => {
    try {
        const transporter = getTransporter();
        const to = process.env.CONTACT_NOTIFICATION_EMAILS || process.env.SMTP_USER;
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to,
            subject: subject ? `New Contact Inquiry: ${subject}` : 'New Contact Inquiry - Pandit Katha Kalyan',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #1f2937; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                        .field { margin-bottom: 16px; }
                        .label { font-weight: bold; color: #111827; }
                        .value { margin-top: 4px; color: #4b5563; }
                        .footer { color: #6b7280; font-size: 13px; margin-top: 30px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header"><h1>New Contact Inquiry</h1></div>
                        <div class="content">
                            <div class="field"><div class="label">Name</div><div class="value">${name}</div></div>
                            <div class="field"><div class="label">Email</div><div class="value">${email}</div></div>
                            ${phone ? `<div class="field"><div class="label">Phone</div><div class="value">${phone}</div></div>` : ''}
                            <div class="field"><div class="label">Subject</div><div class="value">${subject}</div></div>
                            <div class="field"><div class="label">Message</div><div class="value">${message}</div></div>
                            <div class="footer">This inquiry was submitted through the Pandit Katha Kalyan contact form.</div>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Inquiry notification email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending inquiry email:', error);
        return { success: false, error: error.message };
    }
};

const sendOrderConfirmationEmail = async (email, username, order) => {
    try {
        const transporter = getTransporter();
        const shortId = String(order._id).slice(-6).toUpperCase();
        const rows = (order.items || []).map(i =>
            `<tr><td style="padding:6px 0;color:#4b5563">${i.name} × ${i.quantity || 1}</td><td style="padding:6px 0;text-align:right;color:#111827">₹${((Number(i.price) || 0) * (Number(i.quantity) || 1)).toFixed(2)}</td></tr>`
        ).join('');
        const pdf = await generateOrderInvoicePdf(order);
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: `Order Confirmed #${shortId} - Pandit Katha Kalyan`,
            attachments: pdf ? [{ filename: `Invoice-${order.invoiceNumber || shortId}.pdf`, content: pdf, contentType: 'application/pdf' }] : [],
            html: `
                <!DOCTYPE html><html><head><style>
                    body{font-family:Arial,sans-serif;color:#333;line-height:1.5}
                    .container{max-width:600px;margin:0 auto;padding:20px}
                    .header{background:#16a34a;color:#fff;padding:20px;border-radius:10px 10px 0 0;text-align:center}
                    .content{background:#fafafa;padding:30px;border-radius:0 0 10px 10px}
                    table{width:100%;border-collapse:collapse}
                    .total{font-size:20px;font-weight:bold;color:#111827;margin-top:16px}
                    .footer{color:#6b7280;font-size:13px;margin-top:30px}
                </style></head><body><div class="container">
                    <div class="header"><h1>Order Confirmed</h1></div>
                    <div class="content">
                        <p>Hi <strong>${username}</strong>,</p>
                        <p>Thank you! Your order <strong>#${shortId}</strong> has been placed.</p>
                        ${order.invoiceNumber ? `<p style="color:#6b7280;font-size:13px">Invoice: ${order.invoiceNumber}</p>` : ''}
                        <table>${rows}</table>
                        <p class="total">Total: ₹${(Number(order.totalAmount) || 0).toFixed(2)}</p>
                        <p>Payment: ${order.paymentMethod === 'CashOnDelivery' ? 'Cash on Delivery' : 'Online (Razorpay)'}</p>
                        <p>${pdf ? 'Your invoice is attached as a PDF.' : 'You can download your invoice from the Orders page.'}</p>
                        <p>Thanks,<br>Pandit Katha Kalyan Team</p>
                    </div>
                    <div class="footer">This is an automated message. Please do not reply directly.</div>
                </div></body></html>
            `,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Order confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        return { success: false, error: error.message };
    }
};

const sendBookingConfirmationEmail = async (email, username, booking) => {
    try {
        const transporter = getTransporter();
        const shortId = String(booking._id).slice(-6).toUpperCase();
        const total = Number(booking.totalAmount) || Number(booking.price) || 0;
        const when = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const pdf = await generateBookingInvoicePdf(booking);
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'Pandit Katha Kalyan'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: `Booking Confirmed #${shortId} - Pandit Katha Kalyan`,
            attachments: pdf ? [{ filename: `Invoice-${booking.invoiceNumber || shortId}.pdf`, content: pdf, contentType: 'application/pdf' }] : [],
            html: `
                <!DOCTYPE html><html><head><style>
                    body{font-family:Arial,sans-serif;color:#333;line-height:1.5}
                    .container{max-width:600px;margin:0 auto;padding:20px}
                    .header{background:#ea580c;color:#fff;padding:20px;border-radius:10px 10px 0 0;text-align:center}
                    .content{background:#fafafa;padding:30px;border-radius:0 0 10px 10px}
                    .row{display:flex;justify-content:space-between;padding:4px 0;color:#4b5563}
                    .total{font-size:20px;font-weight:bold;color:#111827;margin-top:16px}
                    .footer{color:#6b7280;font-size:13px;margin-top:30px}
                </style></head><body><div class="container">
                    <div class="header"><h1>Booking Confirmed</h1></div>
                    <div class="content">
                        <p>Hi <strong>${username}</strong>,</p>
                        <p>Your booking <strong>#${shortId}</strong> for <strong>${booking.occasion || 'a puja'}</strong> is confirmed.</p>
                        ${booking.invoiceNumber ? `<p style="color:#6b7280;font-size:13px">Invoice: ${booking.invoiceNumber}</p>` : ''}
                        <p>Date: ${when}${booking.timeSlot ? ` · Slot: ${booking.timeSlot}` : ''}</p>
                        <p>Service fee: ₹${(Number(booking.price) || 0).toFixed(2)}${booking.gstAmount ? ` + GST ₹${Number(booking.gstAmount).toFixed(2)}` : ''}</p>
                        <p class="total">Total: ₹${total.toFixed(2)}</p>
                        <p>Payment: ${booking.paymentMethod === 'Online' ? 'Online (Razorpay)' : 'Pay After Service'}</p>
                        <p>${pdf ? 'Your invoice is attached as a PDF.' : 'You can download your invoice from the Bookings page.'}</p>
                        <p>Thanks,<br>Pandit Katha Kalyan Team</p>
                    </div>
                    <div class="footer">This is an automated message. Please do not reply directly.</div>
                </div></body></html>
            `,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('Booking confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending booking confirmation email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOTPEmail,
    sendPasswordResetConfirmation,
    sendBookingCancellationEmail,
    sendOrderCancellationEmail,
    sendOrderConfirmationEmail,
    sendBookingConfirmationEmail,
    sendInquiryEmail,
    verifyEmailTransport,
};
