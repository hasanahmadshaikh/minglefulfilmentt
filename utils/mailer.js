const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendOTP = async (email, otp) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"Mingle Fulfilment" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email - OTP Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0094FF;">Welcome to Mingle Fulfilment</h2>
          <p>Thank you for signing up. Please use the following 6-digit verification code to complete your registration:</p>
          <div style="font-size: 32px; font-weight: bold; color: #0094FF; border: 1px dashed #0094FF; padding: 10px; text-align: center; margin: 20px 0; letter-spacing: 5px;">
            ${otp}
          </div>
          <p>This code is valid for <strong>2 minutes</strong>. If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Mingle Fulfilment Support Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

const sendResetLink = async (email, resetUrl) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"Mingle Fulfilment" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Password - Mingle Fulfilment',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0094FF;">Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to choose a new one:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #0094FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>If you did not request a password reset, you can safely ignore this email. This link will expire in <strong>1 hour</strong>.</p>
          <p style="font-size: 12px; color: #64748b; word-break: break-all;">Alternatively, copy and paste this link into your browser:<br>${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Mingle Fulfilment Support Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Reset email failed:', error);
    return false;
  }
};

module.exports = { sendOTP, sendResetLink };
