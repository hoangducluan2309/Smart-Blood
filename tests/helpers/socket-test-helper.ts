export interface SocketEventFrame {
  event: string;
  payload: Record<string, unknown>;
  receivedAtMs: number;
}

export interface SocketTestClient {
  waitForEvent: (eventName: string, timeoutMs?: number) => Promise<SocketEventFrame>;
  close: () => Promise<void>;
}

function parseFrameData(
  raw: string,
  nsPrefix: string,
): { kind: 'connect' | 'error' | 'event'; frame?: SocketEventFrame; message?: string } | null {
  if (raw.startsWith(`40${nsPrefix}`)) {
    return { kind: 'connect' };
  }
  if (raw.startsWith(`44${nsPrefix},`)) {
    const body = JSON.parse(raw.slice(`44${nsPrefix},`.length)) as { message?: string };
    return { kind: 'error', message: body.message ?? 'CONNECT_ERROR' };
  }
  if (raw.startsWith(`42${nsPrefix},`)) {
    const [event, payload] = JSON.parse(
      raw.slice(`42${nsPrefix},`.length),
    ) as [string, Record<string, unknown>];
    return { kind: 'event', frame: { event, payload, receivedAtMs: Date.now() } };
  }
  return null;
}

function deliverEventFrame(options: {
  frame: SocketEventFrame;
  events: SocketEventFrame[];
  waiters: Array<{ eventName: string; resolve: (f: SocketEventFrame) => void }>;
}): void {
  const idx = options.waiters.findIndex((w) => w.eventName === options.frame.event);
  if (idx >= 0) {
    const [waiter] = options.waiters.splice(idx, 1);
    waiter?.resolve(options.frame);
    return;
  }
  options.events.push(options.frame);
}

function attachSocketHandlers(options: {
  ws: WebSocket;
  ns: string;
  auth: Record<string, unknown>;
  events: SocketEventFrame[];
  waiters: Array<{ eventName: string; resolve: (f: SocketEventFrame) => void }>;
  onConnect: () => void;
  onError: (err: Error) => void;
}): void {
  options.ws.addEventListener('message', (msg) => {
    const raw = String(msg.data);
    if (raw === '2') {
      options.ws.send('3');
      return;
    }
    if (raw.startsWith('0{')) {
      options.ws.send(`40${options.ns},${JSON.stringify(options.auth)}`);
      return;
    }
    const parsed = parseFrameData(raw, options.ns);
    if (parsed?.kind === 'connect') options.onConnect();
    if (parsed?.kind === 'error') options.onError(new Error(parsed.message));
    if (parsed?.kind === 'event' && parsed.frame) {
      deliverEventFrame({ frame: parsed.frame, events: options.events, waiters: options.waiters });
    }
  });
}

function createEventWaiter(
  events: SocketEventFrame[],
  waiters: Array<{ eventName: string; resolve: (f: SocketEventFrame) => void }>,
) {
  return (eventName: string, timeoutMs = 4000): Promise<SocketEventFrame> => {
    const existingIdx = events.findIndex((item) => item.event === eventName);
    if (existingIdx >= 0) {
      return Promise.resolve(events.splice(existingIdx, 1)[0]!);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout waiting for socket event ${eventName}`)),
        timeoutMs,
      );
      waiters.push({
        eventName,
        resolve: (frame) => {
          clearTimeout(timer);
          resolve(frame);
        },
      });
    });
  };
}

function awaitHandshake(options: {
  ws: WebSocket;
  ns: string;
  auth: Record<string, unknown>;
  events: SocketEventFrame[];
  waiters: Array<{ eventName: string; resolve: (f: SocketEventFrame) => void }>;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket handshake timeout')), 3000);
    options.ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket transport error'));
    });
    attachSocketHandlers({
      ...options,
      onConnect: () => {
        clearTimeout(timer);
        resolve();
      },
      onError: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

export async function connectSocketNamespace(options: {
  baseUrl: string;
  namespace: string;
  auth?: Record<string, unknown>;
}): Promise<SocketTestClient> {
  const wsUrl = options.baseUrl.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsUrl}/socket.io/?EIO=4&transport=websocket`);
  const events: SocketEventFrame[] = [];
  const waiters: Array<{ eventName: string; resolve: (f: SocketEventFrame) => void }> = [];
  await awaitHandshake({ ws, ns: options.namespace, auth: options.auth ?? {}, events, waiters });

  return {
    waitForEvent: createEventWaiter(events, waiters),
    close: async () => {
      ws.close();
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  };
}
