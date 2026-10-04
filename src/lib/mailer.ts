import nodemailer from "nodemailer";
import env from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: env.EMAIL_PORT === 465,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const sendEmail = async ({ to, subject, html }: SendEmailParams): Promise<boolean> => {
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("[mailer] Failed to send email", { to, subject, error: (err as Error)?.message });
    return false;
  }
};

export const sendVerificationEmail = async (
  email: string,
  name: string,
  url: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: "Verify your email — Rahmah Institute",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Verify your email address</h2>
        <p>Assalamu Alaikum ${name},</p>
        <p>Click the button below to verify your email and activate your Rahmah Institute account.</p>
        <a href="${url}" style="display:inline-block;background:#3498db;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Verify Email</a>
        <p style="color:#888;font-size:12px;">If you did not create this account, you can ignore this email.</p>
        <p>JazakAllahu Khairan,<br/>The Rahmah Institute Team</p>
      </div>
    `,
  });
};

export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: "Welcome to Rahmah Institute!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Welcome to Rahmah Institute!</h2>
        <p>Assalamu Alaikum ${name},</p>
        <p>Your account has been created. You can now log in and start exploring our platform.</p>
        <p>JazakAllahu Khairan,<br/>The Rahmah Institute Team</p>
      </div>
    `,
  });
};

export const sendOfflineMessageEmail = async (
  email: string,
  senderName: string,
  chatLink: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `New message from ${senderName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">New Message from ${senderName}</h2>
        <p>You have a new message while you were offline.</p>
        <a href="${chatLink}" style="display:inline-block;background:#3498db;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">View Message</a>
      </div>
    `,
  });
};

export const sendOTPEmail = async (
  email: string,
  name: string,
  otp: string,
  purpose: "email-verification" | "sign-in" | "forget-password"
): Promise<boolean> => {
  const subjectByPurpose: Record<typeof purpose, string> = {
    "email-verification": "Verify your email — Rahmah Institute",
    "sign-in": "Your sign-in code — Rahmah Institute",
    "forget-password": "Your password reset code — Rahmah Institute",
  };

  return sendEmail({
    to: email,
    subject: subjectByPurpose[purpose],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Your verification code</h2>
        <p>Assalamu Alaikum ${name},</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f4f4f4;padding:16px;text-align:center;border-radius:6px;">${otp}</p>
        <p>This code expires in a few minutes. If you did not request this, you can ignore this email.</p>
        <p>JazakAllahu Khairan,<br/>The Rahmah Institute Team</p>
      </div>
    `,
  });
};

export const sendResetPasswordEmail = async (
  email: string,
  name: string,
  url: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: "Reset your password — Rahmah Institute",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Reset your password</h2>
        <p>Assalamu Alaikum ${name},</p>
        <p>Click below to reset your password. This link expires in 1 hour.</p>
        <a href="${url}" style="display:inline-block;background:#3498db;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Reset Password</a>
        <p style="color:#888;font-size:12px;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
};

export const sendModeratorInvitationEmail = async (
  email: string,
  name: string,
  acceptUrl: string,
  rejectUrl: string,
  expiresAt: Date
): Promise<void> => {
  const expiryStr = expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await sendEmail({
    to: email,
    subject: "You've been invited to become a Moderator — Rahmah Institute",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Moderator Invitation</h2>
        <p>Assalamu Alaikum ${name},</p>
        <p>An administrator has invited you to become a <strong>Moderator</strong> at Rahmah Institute.</p>
        <p>As a moderator, you will be able to help manage the platform and support our community.</p>
        <p style="margin:20px 0;">
          <a href="${acceptUrl}" style="display:inline-block;background:#27ae60;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin-right:8px;">Accept Invitation</a>
          <a href="${rejectUrl}" style="display:inline-block;background:#e74c3c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">Reject</a>
        </p>
        <p style="color:#888;font-size:12px;">This invitation expires on ${expiryStr}. If you did not expect this, you can safely ignore or reject it.</p>
        <p>JazakAllahu Khairan,<br/>The Rahmah Institute Team</p>
      </div>
    `,
  });
};

export const sendModeratorActionEmail = async (
  email: string,
  moderatorName: string,
  action: "accepted" | "rejected" | "revoked"
): Promise<void> => {
  const messages: Record<typeof action, { subject: string; body: string }> = {
    accepted: {
      subject: "Moderator invitation accepted — Rahmah Institute",
      body: `<p><strong>${moderatorName}</strong> has accepted the moderator invitation and is now a moderator.</p>`,
    },
    rejected: {
      subject: "Moderator invitation rejected — Rahmah Institute",
      body: `<p><strong>${moderatorName}</strong> has rejected the moderator invitation.</p>`,
    },
    revoked: {
      subject: "Moderator access revoked — Rahmah Institute",
      body: `<p>Moderator access for <strong>${moderatorName}</strong> has been revoked.</p>`,
    },
  };

  const { subject, body } = messages[action];

  await sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Moderator Update</h2>
        ${body}
        <p>JazakAllahu Khairan,<br/>The Rahmah Institute Team</p>
      </div>
    `,
  });
};

export const sendModeratorCredentialsEmail = async (
  email: string,
  tempPassword: string,
  loginUrl: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: "You've been added as a Moderator — Rahmah Institute",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2c3e50;">Welcome to the Rahmah Institute moderator team</h2>
        <p>Assalamu Alaikum,</p>
        <p>An administrator has created a <strong>Moderator</strong> account for you. Use the temporary credentials below to log in:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;font-weight:bold;">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Temporary password</td><td style="padding:8px 0;font-weight:bold;font-family:monospace;background:#f4f4f4;border-radius:4px;">${tempPassword}</td></tr>
        </table>
        <p style="color:#c0392b;font-weight:bold;">For security, please log in and change this password immediately after your first sign-in.</p>
        <a href="${loginUrl}" style="display:inline-block;background:#3498db;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Log In</a>
        <p>JazakAllahu Khairan,<br/>The Rahmah Institute Team</p>
      </div>
    `,
  });
};

export { transporter, sendEmail };
