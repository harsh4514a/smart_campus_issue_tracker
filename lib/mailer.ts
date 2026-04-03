import nodemailer from "nodemailer";
import User from "@/models/User";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const DEMO_EMAILS = new Set(
  [
    process.env.DEMO_STUDENT_EMAIL || "demo.student@charusat.edu.in",
    process.env.DEMO_STAFF_EMAIL || "demo.worker@charusat.ac.in",
    process.env.DEMO_ADMIN_EMAIL || "demo.admin@CampusTrackerer.com",
    process.env.DEMO_DEPT_ADMIN_EMAIL || "demo.deptadmin@charusat.ac.in",
  ]
    .map((email) => String(email).trim().toLowerCase())
);

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isDemoEmailRecipient(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  if (DEMO_EMAILS.has(normalizedEmail)) return true;

  const user = await User.findOne({ email: normalizedEmail }).select("isDemoUser").lean<{ isDemoUser?: boolean }>();
  return user?.isDemoUser === true;
}

export async function sendOtpEmail(to: string, otp: string) {
  if (await isDemoEmailRecipient(to)) return;

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject: "Your Smart Campus verification code",
    priority: "high",
    text: `Your verification code is ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It will expire in 5 minutes.</p>`,
  });
}

export async function sendPasswordSetupEmail(to: string, name: string, setupUrl: string) {
  if (await isDemoEmailRecipient(to)) return;

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject: "Set your Smart Campus account password",
    priority: "high",
    text: `Hello ${name},\n\nYour account has been created. Set your password using this secure link: ${setupUrl}\n\nThis link expires in 24 hours.\n\nIf you did not expect this email, please ignore it.`,
    html: `
      <p>Hello ${name},</p>
      <p>Your account has been created.</p>
      <p>
        Please set your password using this secure link:<br />
        <a href="${setupUrl}">${setupUrl}</a>
      </p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not expect this email, please ignore it.</p>
    `,
  });
}