import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/app-error.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import type { EventStatus, PaginationMeta } from '../../types/domain.js';
import {
  changeEventStatus,
  findEventById,
  findEventProgress,
  insertDonationEvent,
  queryEvents,
  type EventRow,
} from './repository.js';
import type { CreateEventInput, ListEventsQuery } from './schemas.js';

function buildCheckInUrl(eventId: string): string {
  return `${env.APP_BASE_URL}/checkin?eventId=${eventId}`;
}

async function getEventOrThrow(eventId: string): Promise<EventRow> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError({
      message: 'Không tìm thấy sự kiện hiến máu',
      statusCode: 404,
      code: 'EVENT_NOT_FOUND',
    });
  }
  return event;
}

export async function createDonationEvent(options: {
  input: CreateEventInput;
  createdBy: string;
  ip: string | null;
}): Promise<EventRow & { checkInUrl: string }> {
  const event = await insertDonationEvent(options);
  return { ...event, checkInUrl: buildCheckInUrl(event.id) };
}

export async function listDonationEvents(query: ListEventsQuery): Promise<{
  items: EventRow[];
  pagination: PaginationMeta;
}> {
  const { rows, total } = await queryEvents(query);
  return {
    items: rows,
    pagination: buildPaginationMeta({ page: query.page, limit: query.limit, total }),
  };
}

export async function getEventProgressSummary(eventId: string) {
  const row = await findEventProgress(eventId);
  if (!row) {
    throw new AppError({
      message: 'Không tìm thấy sự kiện hiến máu',
      statusCode: 404,
      code: 'EVENT_NOT_FOUND',
    });
  }
  const progressPercent = Math.min(
    100,
    Math.round((row.soLuongThucTe / row.chiTieuSoLuong) * 1000) / 10,
  );
  return { ...row, progressPercent };
}

export async function updateEventStatus(options: {
  eventId: string;
  trangThai: EventStatus;
  updatedBy: string;
  ip: string | null;
}) {
  return changeEventStatus(options);
}

async function renderStandeePdf(event: EventRow, qrPngBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#BA1C1D').fontSize(24).text('SMARTBLOOD - NGAY HOI HIEN MAU NHAN DAO', {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc.fillColor('#0F172A').fontSize(18).text(event.tenSuKien, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Ma su kien: ${event.maSuKien} | Dia diem: ${event.diaDiem}`, {
      align: 'center',
    });
    doc.moveDown(1.5);
    doc.image(qrPngBuffer, (doc.page.width - 260) / 2, doc.y, { width: 260 });
    doc.moveDown(16);
    doc.fillColor('#00558F').fontSize(14).text(
      'Quet ma QR de check-in nhanh (khong can dang nhap)',
      { align: 'center' },
    );
    doc.end();
  });
}

export async function generateEventQrAsset(options: {
  eventId: string;
  format: 'png' | 'svg' | 'pdf';
}): Promise<{ contentType: string; filename: string; body: Buffer | string }> {
  const event = await getEventOrThrow(options.eventId);
  const targetUrl = buildCheckInUrl(event.id);
  if (options.format === 'svg') {
    const svg = await QRCode.toString(targetUrl, { type: 'svg', margin: 2, width: 800 });
    return { contentType: 'image/svg+xml', filename: `${event.maSuKien}-qr.svg`, body: svg };
  }

  const png = await QRCode.toBuffer(targetUrl, { type: 'png', margin: 2, width: 800 });
  if (options.format === 'pdf') {
    const pdf = await renderStandeePdf(event, png);
    return { contentType: 'application/pdf', filename: `${event.maSuKien}-standee.pdf`, body: pdf };
  }
  return { contentType: 'image/png', filename: `${event.maSuKien}-qr.png`, body: png };
}
