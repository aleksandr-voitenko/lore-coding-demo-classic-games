#!/usr/bin/env node

import http from "node:http";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

export const LATENCY_PROFILES = {
  bad: {
    dropRate: 0.02,
    jitterMs: 50,
    rttMs: 180,
  },
  good: {
    dropRate: 0,
    jitterMs: 5,
    rttMs: 40,
  },
  lan: {
    dropRate: 0,
    jitterMs: 0,
    rttMs: 0,
  },
  normal: {
    dropRate: 0,
    jitterMs: 15,
    rttMs: 80,
  },
  rough: {
    dropRate: 0,
    jitterMs: 30,
    rttMs: 120,
  },
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3002;
const DEFAULT_TARGET = "http://127.0.0.1:3001";
const DEFAULT_PROFILE = "normal";
const DEFAULT_SEED = "multiplayer-latency-lab";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function resolveLatencyProxyConfig(env = process.env) {
  const profileName = (env.MULTIPLAYER_LATENCY_PROXY_PROFILE ?? DEFAULT_PROFILE)
    .trim()
    .toLowerCase();
  const profile = LATENCY_PROFILES[profileName];

  if (profile === undefined) {
    throw new Error(
      `Unsupported MULTIPLAYER_LATENCY_PROXY_PROFILE "${profileName}".`,
    );
  }

  const target = new URL(
    env.MULTIPLAYER_LATENCY_PROXY_TARGET ?? DEFAULT_TARGET,
  );

  return {
    dropRate: readNumberEnv(
      env.MULTIPLAYER_LATENCY_PROXY_DROP_RATE,
      profile.dropRate,
      { max: 1, min: 0, name: "MULTIPLAYER_LATENCY_PROXY_DROP_RATE" },
    ),
    host: (env.MULTIPLAYER_LATENCY_PROXY_HOST ?? DEFAULT_HOST).trim(),
    jitterMs: readNumberEnv(
      env.MULTIPLAYER_LATENCY_PROXY_JITTER_MS,
      profile.jitterMs,
      { min: 0, name: "MULTIPLAYER_LATENCY_PROXY_JITTER_MS" },
    ),
    port: readIntegerEnv(
      env.MULTIPLAYER_LATENCY_PROXY_PORT,
      DEFAULT_PORT,
      { min: 0, name: "MULTIPLAYER_LATENCY_PROXY_PORT" },
    ),
    profileName,
    rttMs: readNumberEnv(
      env.MULTIPLAYER_LATENCY_PROXY_RTT_MS,
      profile.rttMs,
      { min: 0, name: "MULTIPLAYER_LATENCY_PROXY_RTT_MS" },
    ),
    seed: env.MULTIPLAYER_LATENCY_PROXY_SEED ?? DEFAULT_SEED,
    targetHttpOrigin: toHttpOrigin(target),
    targetWebSocketOrigin:
      env.MULTIPLAYER_LATENCY_PROXY_WS_TARGET === undefined
        ? toWebSocketOrigin(target)
        : toWebSocketOrigin(
            new URL(env.MULTIPLAYER_LATENCY_PROXY_WS_TARGET),
          ),
  };
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed);

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function getLatencyHopDelayMs({ jitterMs, rttMs }, random = Math.random) {
  const baseDelayMs = rttMs / 2;
  const jitterRadiusMs = jitterMs / 2;

  if (jitterRadiusMs <= 0) {
    return Math.round(baseDelayMs);
  }

  const jitterOffsetMs = (random() * 2 - 1) * jitterRadiusMs;

  return Math.max(0, Math.round(baseDelayMs + jitterOffsetMs));
}

export function shouldDropLatencyFrame(dropRate, random = Math.random) {
  return dropRate > 0 && random() < dropRate;
}

export function getForwardableWebSocketCloseCode(code) {
  if (code === 1000 || (code >= 3000 && code <= 4999)) {
    return code;
  }

  return undefined;
}

export function createMultiplayerLatencyProxy(config) {
  const random = createSeededRandom(config.seed);
  const server = http.createServer((request, response) => {
    void handleHttpRequest({ config, random, request, response });
  });
  const webSocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    webSocketServer.handleUpgrade(request, socket, head, (clientSocket) => {
      proxyWebSocket({ clientSocket, config, random, request });
    });
  });

  return {
    close: () =>
      new Promise((resolve, reject) => {
        webSocketServer.close((webSocketError) => {
          server.close((serverError) => {
            const error = webSocketError ?? serverError;

            if (error !== undefined) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }),
    server,
    webSocketServer,
  };
}

async function handleHttpRequest({ config, random, request, response }) {
  if (request.url === "/healthz") {
    writeJson(response, 200, {
      profile: config.profileName,
      service: "multiplayer-latency-proxy",
      target: config.targetHttpOrigin,
    });
    return;
  }

  try {
    const targetUrl = new URL(request.url ?? "/", config.targetHttpOrigin);
    const requestBody = await readRequestBody(request);

    await delay(getLatencyHopDelayMs(config, random));

    const upstreamResponse = await fetch(targetUrl, {
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : requestBody,
      headers: getForwardHeaders(request.headers),
      method: request.method,
      redirect: "manual",
    });
    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());

    await delay(getLatencyHopDelayMs(config, random));

    response.writeHead(
      upstreamResponse.status,
      getResponseHeaders(upstreamResponse.headers),
    );
    response.end(responseBody);
  } catch (error) {
    writeJson(response, 502, {
      error:
        error instanceof Error
          ? error.message
          : "Latency proxy request failed.",
    });
  }
}

function proxyWebSocket({ clientSocket, config, random, request }) {
  const upstreamUrl = new URL(
    request.url ?? "/",
    config.targetWebSocketOrigin,
  );
  const upstreamSocket = new WebSocket(upstreamUrl);
  const sendToClient = createBufferedSender(clientSocket);
  const sendToUpstream = createBufferedSender(upstreamSocket);

  clientSocket.on("message", (data, isBinary) => {
    scheduleWebSocketFrame({
      config,
      data,
      isBinary,
      random,
      send: sendToUpstream,
    });
  });

  upstreamSocket.on("message", (data, isBinary) => {
    scheduleWebSocketFrame({
      config,
      data,
      isBinary,
      random,
      send: sendToClient,
    });
  });

  clientSocket.on("close", (code, reason) => {
    if (upstreamSocket.readyState === WebSocket.OPEN) {
      closeWebSocketPeer(upstreamSocket, code, reason);
    }
  });
  upstreamSocket.on("close", (code, reason) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      closeWebSocketPeer(clientSocket, code, reason);
    }
  });
  clientSocket.on("error", () => upstreamSocket.terminate());
  upstreamSocket.on("error", () => clientSocket.terminate());
}

function closeWebSocketPeer(socket, code, reason) {
  const forwardableCode = getForwardableWebSocketCloseCode(code);

  if (forwardableCode === undefined) {
    socket.close();
    return;
  }

  socket.close(forwardableCode, reason);
}

function scheduleWebSocketFrame({ config, data, isBinary, random, send }) {
  if (shouldDropLatencyFrame(config.dropRate, random)) {
    return;
  }

  const payload = Buffer.isBuffer(data) ? Buffer.from(data) : data;
  const delayMs = getLatencyHopDelayMs(config, random);

  setTimeout(() => {
    send(payload, isBinary);
  }, delayMs);
}

function createBufferedSender(socket) {
  const pendingFrames = [];

  socket.on("open", () => {
    while (pendingFrames.length > 0 && socket.readyState === WebSocket.OPEN) {
      const frame = pendingFrames.shift();

      socket.send(frame.data, { binary: frame.isBinary });
    }
  });

  return (data, isBinary) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data, { binary: isBinary });
      return;
    }

    if (socket.readyState === WebSocket.CONNECTING) {
      pendingFrames.push({ data, isBinary });
    }
  };
}

function readIntegerEnv(value, fallback, { min, name }) {
  const parsedValue = readNumberEnv(value, fallback, { min, name });

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`${name} must be an integer.`);
  }

  return parsedValue;
}

function readNumberEnv(value, fallback, { max = Number.POSITIVE_INFINITY, min, name }) {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < min || parsedValue > max) {
    throw new Error(`${name} must be a number from ${min} to ${max}.`);
  }

  return parsedValue;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on("error", reject);
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

function delay(ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getForwardHeaders(headers) {
  const forwardedHeaders = {};

  for (const [header, value] of Object.entries(headers)) {
    if (
      value === undefined ||
      HOP_BY_HOP_HEADERS.has(header.toLowerCase())
    ) {
      continue;
    }

    forwardedHeaders[header] = Array.isArray(value) ? value.join(", ") : value;
  }

  return forwardedHeaders;
}

function getResponseHeaders(headers) {
  const responseHeaders = {};

  for (const [header, value] of headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(header.toLowerCase())) {
      continue;
    }

    responseHeaders[header] = value;
  }

  return responseHeaders;
}

function toHttpOrigin(url) {
  const protocol = url.protocol === "https:" ? "https:" : "http:";

  return `${protocol}//${url.host}`;
}

function toWebSocketOrigin(url) {
  const protocol =
    url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";

  return `${protocol}//${url.host}`;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function hashSeed(seed) {
  let hash = 2_166_136_261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

async function main() {
  const config = resolveLatencyProxyConfig();
  const proxy = createMultiplayerLatencyProxy(config);

  proxy.server.listen(config.port, config.host, () => {
    console.info(
      [
        `Multiplayer latency proxy listening on http://${config.host}:${config.port}`,
        `target=${config.targetHttpOrigin}`,
        `profile=${config.profileName}`,
        `rtt=${config.rttMs}ms`,
        `jitter=${config.jitterMs}ms`,
        `drop=${config.dropRate}`,
      ].join(" "),
    );
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
