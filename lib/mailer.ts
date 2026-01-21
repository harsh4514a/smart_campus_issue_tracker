import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
  throw new Error("SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
}

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  pool: true,
  maxConnections: 5,
  maxMessages: Infinity,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  connectionTimeout: 20_000,
  socketTimeout: 20_000,
});

export async function sendOtpEmail(to: string, otp: string) {
  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject: "Your Smart Campus verification code",
    priority: "high",
    text: `Your verification code is ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It will expire in 5 minutes.</p>`,
  });
}