import type { Server as HttpServer } from 'node:http';
import sql from 'mssql';
import { type Namespace, Server, type Socket } from 'socket.io';

import { mainPool } from '../config/database.js';
import { env } from '../config/env.js';
import { verifyTokenString } from '../middleware/auth.js';
import { domainEvents } from '../shared/domain-events.js';
import { logger } from '../shared/logger.js';
import type { AuthUser, UserRole } from '../types/domain.js';

interface AuthedSocket extends Socket {
  data: {
    user?: AuthUser;
    checkInId?: string;
    eventId?: string;
  };
}

interface SocketNamespaces {
  staffNs: Namespace;
  donorNs: Namespace;
  displayNs: Namespace;
  emergencyNs: Namespace;
  inventoryNs: Namespace;
  hospitalNs: Namespace;
}

function extractSocketToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function createJwtNamespaceAuth(allowedRoles: readonly UserRole[]) {
  return (socket: AuthedSocket, next: (err?: Error) => void): void => {
    const token = extractSocketToken(socket);
    if (!token) {
      next(new Error('UNAUTHORIZED'));
      return;
    }
    try {
      const user = verifyTokenString(token);
      if (!allowedRoles.includes(user.vaiTro)) {
        next(new Error('FORBIDDEN'));
        return;
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  };
}

async function verifyDonorHandshake(
  socket: AuthedSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const checkInId = socket.handshake.auth?.checkInId;
  const trackingToken = socket.handshake.auth?.trackingToken;
  if (typeof checkInId !== 'string' || typeof trackingToken !== 'string') {
    next(new Error('UNAUTHORIZED'));
    return;
  }
  try {
    const req = mainPool.request();
    req.input('Id', sql.UniqueIdentifier, checkInId);
    req.input('Token', sql.VarChar(128), trackingToken);
    const res = await req.query<{ id: string }>(
      'SELECT id FROM dbo.DonorCheckIns WHERE id = @Id AND trackingToken = @Token;',
    );
    if (!res.recordset[0]) {
      next(new Error('UNAUTHORIZED'));
      return;
    }
    socket.data.checkInId = checkInId;
    next();
  } catch {
    next(new Error('INTERNAL_ERROR'));
  }
}

async function verifyDisplayHandshake(
  socket: AuthedSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const eventId = socket.handshake.auth?.eventId;
  if (typeof eventId !== 'string') {
    next(new Error('EVENT_ID_REQUIRED'));
    return;
  }
  try {
    const req = mainPool.request();
    req.input('EventId', sql.UniqueIdentifier, eventId);
    const res = await req.query<{ id: string }>(
      'SELECT id FROM dbo.DonationEvents WHERE id = @EventId;',
    );
    if (!res.recordset[0]) {
      next(new Error('EVENT_NOT_FOUND'));
      return;
    }
    socket.data.eventId = eventId;
    next();
  } catch {
    next(new Error('INTERNAL_ERROR'));
  }
}

function setupStaffNamespace(io: Server): Namespace {
  const staffNs = io.of('/staff');
  staffNs.use(createJwtNamespaceAuth(['RED_CROSS_STAFF', 'ADMIN']));
  staffNs.on('connection', (socket: AuthedSocket) => {
    const eventId = socket.handshake.auth?.eventId;
    if (typeof eventId === 'string') {
      void socket.join(`event:${eventId}`);
    }
  });
  return staffNs;
}

function setupStaffAndPublicNamespaces(io: Server): {
  staffNs: Namespace;
  donorNs: Namespace;
  displayNs: Namespace;
} {
  const staffNs = setupStaffNamespace(io);
  const donorNs = io.of('/donor');
  donorNs.use((socket, next) => void verifyDonorHandshake(socket as AuthedSocket, next));
  donorNs.on('connection', (socket: AuthedSocket) => {
    if (socket.data.checkInId) {
      void socket.join(`checkin:${socket.data.checkInId}`);
    }
  });
  const displayNs = io.of('/display');
  displayNs.use((socket, next) => void verifyDisplayHandshake(socket as AuthedSocket, next));
  displayNs.on('connection', (socket: AuthedSocket) => {
    if (socket.data.eventId) {
      void socket.join(`display:${socket.data.eventId}`);
    }
  });
  return { staffNs, donorNs, displayNs };
}

function setupNamespaces(io: Server): SocketNamespaces {
  const { staffNs, donorNs, displayNs } = setupStaffAndPublicNamespaces(io);

  const emergencyNs = io.of('/emergency');
  emergencyNs.use(createJwtNamespaceAuth(['RED_CROSS_STAFF', 'ADMIN']));

  const inventoryNs = io.of('/inventory');
  inventoryNs.use(createJwtNamespaceAuth(['ADMIN', 'RED_CROSS_STAFF', 'HOSPITAL_STAFF']));

  const hospitalNs = io.of('/hospital');
  hospitalNs.use(createJwtNamespaceAuth(['ADMIN', 'RED_CROSS_STAFF', 'HOSPITAL_STAFF']));

  return { staffNs, donorNs, displayNs, emergencyNs, inventoryNs, hospitalNs };
}

function registerQueueEvents(ns: SocketNamespaces): void {
  domainEvents.on('donor:checkin_submitted', (payload) => {
    ns.staffNs.to(`event:${payload.eventId}`).emit('donor:checkin_submitted', payload);
    ns.displayNs.to(`display:${payload.eventId}`).emit('queue:updated', {
      stt: payload.stt,
      buocHienTai: payload.buocHienTai,
    });
  });

  domainEvents.on('medical:step_updated', (payload) => {
    ns.staffNs.to(`event:${payload.eventId}`).emit('medical:step_updated', payload);
    // Khong gui lyDoTamHoan hay hoTen ra /donor va /display
    ns.donorNs.to(`checkin:${payload.checkInId}`).emit('medical:step_updated', {
      checkInId: payload.checkInId,
      stt: payload.stt,
      buocHienTai: payload.buocHienTai,
    });
    ns.displayNs.to(`display:${payload.eventId}`).emit('queue:updated', {
      stt: payload.stt,
      buocHienTai: payload.buocHienTai,
    });
  });
}

function registerOperationsEvents(ns: SocketNamespaces): void {
  domainEvents.on('event:progress_updated', (payload) => {
    ns.staffNs.to(`event:${payload.eventId}`).emit('event:progress_updated', payload);
  });

  domainEvents.on('emergency:red_alert', (payload) => {
    ns.emergencyNs.emit('emergency:red_alert', payload);
    logger.info('socket_emergency_red_alert_emitted', {
      emergencyId: payload.emergencyId,
      hospitalId: payload.hospitalId,
    });
  });

  domainEvents.on('inventory:stock_changed', (payload) => {
    ns.inventoryNs.emit('inventory:stock_changed', payload);
  });

  domainEvents.on('hospital:bag_received', (payload) => {
    ns.hospitalNs.emit('hospital:bag_received', payload);
  });
}

export function attachSocketServer(httpServer: HttpServer): Server {
  domainEvents.removeAllListeners();
  const io = new Server(httpServer, {
    cors: { origin: env.allowedOrigins, credentials: true },
  });

  const namespaces = setupNamespaces(io);
  registerQueueEvents(namespaces);
  registerOperationsEvents(namespaces);

  return io;
}
