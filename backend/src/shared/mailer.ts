import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from './logger.js';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

function createTransporter(): nodemailer.Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export async function sendEmail(input: SendMailInput): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('SMTP chua cau hinh; bo qua gui email thuc te', {
      event: 'mailer.fallback',
      toDomain: input.to.split('@')[1] ?? 'unknown',
      subject: input.subject,
    });
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}

const OTP_BOX_STYLE =
  'background:#F8FAFC;border:1px dashed #00558F;padding:16px;' +
  'text-align:center;margin:20px 0;border-radius:8px';
const OTP_CODE_STYLE = 'font-size:28px;font-weight:bold;letter-spacing:6px;color:#0F172A';

export function buildOtpEmailHtml(options: {
  title: string;
  otp: string;
  description: string;
}): string {
  return [
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">',
    '<h2 style="color:#BA1C1D;margin-top:0;">SmartBlood - Hội Chữ Thập Đỏ TP. Biên Hòa</h2>',
    `<p style="color:#0F172A;font-size:16px;">${options.title}</p>`,
    `<p style="color:#1E293B;font-size:15px;">${options.description}</p>`,
    `<div style="${OTP_BOX_STYLE}"><span style="${OTP_CODE_STYLE}">${options.otp}</span></div>`,
    '<p style="color:#475569;font-size:13px;">Mã có hiệu lực 5 phút. Không chia sẻ mã này.</p>',
    '</div>',
  ].join('');
}
