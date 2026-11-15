import http, { type Server } from 'node:http';
import type { Server as SocketServer } from 'socket.io';

import { createApp } from '../../backend/src/app.js';
import { closeDatabasePools, connectDatabasePools } from '../../backend/src/config/database.js';
import { memoryStore } from '../../backend/src/shared/memory-store.js';
import { attachSocketServer } from '../../backend/src/sockets/index.js';

const socketServers = new WeakMap<Server, SocketServer>();

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: {
    success: boolean;
    data?: T;
    message?: string;
    error?: { code: string; message: string };
  };
}

export async function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  await connectDatabasePools();
  const app = createApp();
  const server = http.createServer(app);
  const io = attachSocketServer(server);
  socketServers.set(server, io);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

export async function stopTestServer(server: Server): Promise<void> {
  const io = socketServers.get(server);
  if (io) {
    await new Promise<void>((resolve) => void io.close(() => resolve()));
  } else {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  memoryStore.dispose();
  await closeDatabasePools();
}

export async function apiRequest<T = unknown>(
  baseUrl: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH';
    path: string;
    token?: string;
    body?: Record<string, unknown>;
  },
): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const parsed = (await response.json()) as HttpResponse<T>['body'];
  return { status: response.status, headers: response.headers, body: parsed };
}

export async function loginAs(
  baseUrl: string,
  credentials: { identifier: string; matKhau: string },
): Promise<string> {
  const res = await apiRequest<{ accessToken: string }>(baseUrl, {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: credentials,
  });
  if (res.status !== 200 || !res.body.data?.accessToken) {
    throw new Error(`Login failed for ${credentials.identifier}: status ${res.status}`);
  }
  return res.body.data.accessToken;
}
