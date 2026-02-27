const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.zoho.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // false for 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
        tls: {
            // Zoho-specific workaround: some cloud environments fail certificate verification
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
        },
        connectionTimeout: 20000, // 20 seconds
        greetingTimeout: 20000,
        socketTimeout: 20000,
    });
};

// Send OTP email
const sendOTPEmail = async (email, otp, username) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'PKK App'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: 'Password Reset OTP - PKK App',
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
                            <h1>Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${username}</strong>,</p>
                            <p>You have requested to reset your password. Please use the following OTP (One-Time Password) to proceed:</p>
                            
                            <div class="otp-box">
                                <div class="otp-code">${otp}</div>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong> This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.
                            </div>
                            
                            <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
                            
                            <p>Best regards,<br>PKK Team</p>
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
        const transporter = createTransporter();

        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'PKK App'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: email,
            subject: 'Password Reset Successful - PKK App',
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
                            
                            <p>Best regards,<br>PKK Team</p>
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

module.exports = {
    sendOTPEmail,
    sendPasswordResetConfirmation,
};
