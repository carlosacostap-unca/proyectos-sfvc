#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

loadEnvFile(process.env.MCP_ENV_FILE);
loadEnvFile(path.join(projectRoot, ".env.local"));

const PB_URL = normalizeUrl(
  process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    process.env.PB_URL ||
    "http://127.0.0.1:8090",
);

const expectedCollections = [
  "projects",
  "personal",
  "project_notes",
  "project_assignments",
  "personal_compensation_periods",
  "work_logs",
  "users",
];

const expectedFields = {
  personal: ["working_hours", "monthly_salary"],
  personal_compensation_periods: ["personal", "start_date", "end_date", "monthly_salary", "shifts"],
  project_notes: ["author_name", "author_email"],
  work_logs: [
    "description",
    "compensation_period",
    "compensation_monthly_salary",
    "compensation_shift_count",
    "compensation_hourly_rate",
    "compensation_labor_cost",
  ],
};

let authAttempted = false;
let authPromise = null;
let pbInstance = null;

const tools = [
  {
    name: "health",
    description: "Check whether the configured Proyectos SFVC PocketBase instance is reachable.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "whoami",
    description: "Show current PocketBase auth state without exposing tokens.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_collections",
    description: "List PocketBase collections.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_collection",
    description: "Get metadata for one PocketBase collection by name or id.",
    inputSchema: {
      type: "object",
      required: ["collection"],
      properties: {
        collection: { type: "string", description: "Collection name or id." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_records",
    description: "List records from a PocketBase collection.",
    inputSchema: {
      type: "object",
      required: ["collection"],
      properties: {
        collection: { type: "string" },
        page: { type: "number", minimum: 1, default: 1 },
        perPage: { type: "number", minimum: 1, maximum: 500, default: 50 },
        sort: { type: "string" },
        filter: { type: "string" },
        expand: { type: "string" },
        fields: { type: "string" },
        fullList: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_record",
    description: "Get one record from a PocketBase collection by id.",
    inputSchema: {
      type: "object",
      required: ["collection", "id"],
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
        expand: { type: "string" },
        fields: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_record",
    description: "Create a record in a PocketBase collection.",
    inputSchema: {
      type: "object",
      required: ["collection", "data"],
      properties: {
        collection: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_record",
    description: "Update a record in a PocketBase collection.",
    inputSchema: {
      type: "object",
      required: ["collection", "id", "data"],
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "delete_record",
    description: "Delete a record from a PocketBase collection.",
    inputSchema: {
      type: "object",
      required: ["collection", "id"],
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_collection",
    description: "Create a PocketBase collection from a raw PocketBase collection schema object.",
    inputSchema: {
      type: "object",
      required: ["schema"],
      properties: {
        schema: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_collection",
    description: "Update a PocketBase collection by name or id using a raw PocketBase collection schema patch.",
    inputSchema: {
      type: "object",
      required: ["collection", "data"],
      properties: {
        collection: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "delete_collection",
    description: "Delete a PocketBase collection by name or id.",
    inputSchema: {
      type: "object",
      required: ["collection"],
      properties: {
        collection: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "validate_proyectos_schema",
    description: "Check whether the PocketBase schema has the collections and fields required by this project.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

const toolHandlers = {
  async health() {
    const response = await fetch(`${PB_URL}/api/health`);
    const body = await response.json().catch(() => ({}));

    return {
      url: PB_URL,
      ok: response.ok,
      status: response.status,
      body,
    };
  },

  async whoami() {
    const pb = await authenticate();

    return {
      url: PB_URL,
      isValid: pb.authStore.isValid,
      tokenPresent: Boolean(pb.authStore.token),
      model: sanitizeAuthModel(pb.authStore.model),
    };
  },

  async list_collections() {
    const data = await adminApi("/api/collections?perPage=500&sort=name");
    return data.items || data;
  },

  async get_collection(args) {
    requireString(args, "collection");
    return adminApi(`/api/collections/${encodeURIComponent(args.collection)}`);
  },

  async list_records(args) {
    const pb = await authenticate();
    requireString(args, "collection");
    const options = pick(args, ["sort", "filter", "expand", "fields"]);

    if (args.fullList) {
      return pb.collection(args.collection).getFullList({
        batch: numberOrDefault(args.perPage, 200),
        ...options,
      });
    }

    return pb
      .collection(args.collection)
      .getList(numberOrDefault(args.page, 1), numberOrDefault(args.perPage, 50), options);
  },

  async get_record(args) {
    const pb = await authenticate();
    requireString(args, "collection");
    requireString(args, "id");
    return pb.collection(args.collection).getOne(args.id, pick(args, ["expand", "fields"]));
  },

  async create_record(args) {
    const pb = await authenticate();
    requireString(args, "collection");
    requireObject(args, "data");
    return pb.collection(args.collection).create(args.data);
  },

  async update_record(args) {
    const pb = await authenticate();
    requireString(args, "collection");
    requireString(args, "id");
    requireObject(args, "data");
    return pb.collection(args.collection).update(args.id, args.data);
  },

  async delete_record(args) {
    const pb = await authenticate();
    requireString(args, "collection");
    requireString(args, "id");
    await pb.collection(args.collection).delete(args.id);
    return { deleted: true, collection: args.collection, id: args.id };
  },

  async create_collection(args) {
    requireObject(args, "schema");
    return adminApi("/api/collections", {
      method: "POST",
      body: JSON.stringify(args.schema),
    });
  },

  async update_collection(args) {
    requireString(args, "collection");
    requireObject(args, "data");
    return adminApi(`/api/collections/${encodeURIComponent(args.collection)}`, {
      method: "PATCH",
      body: JSON.stringify(args.data),
    });
  },

  async delete_collection(args) {
    requireString(args, "collection");
    await adminApi(`/api/collections/${encodeURIComponent(args.collection)}`, {
      method: "DELETE",
    });
    return { deleted: true, collection: args.collection };
  },

  async validate_proyectos_schema() {
    const data = await adminApi("/api/collections?perPage=500&sort=name");
    const collections = data.items || data;
    const byName = new Map(collections.map((collection) => [collection.name, collection]));
    const missingCollections = expectedCollections.filter((name) => !byName.has(name));

    const fieldResults = Object.entries(expectedFields).map(([collectionName, fields]) => {
      const collection = byName.get(collectionName);
      const presentFields = new Set((collection?.fields || collection?.schema || []).map((field) => field.name));

      return {
        collection: collectionName,
        expected: fields,
        present: fields.filter((field) => presentFields.has(field)),
        missing: fields.filter((field) => !presentFields.has(field)),
      };
    });

    return {
      ok: missingCollections.length === 0 && fieldResults.every((result) => result.missing.length === 0),
      url: PB_URL,
      expectedCollections,
      missingCollections,
      fields: fieldResults,
    };
  },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;

  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    write({
      jsonrpc: "2.0",
      error: { code: -32700, message: `Parse error: ${error.message}` },
      id: null,
    });
    return;
  }

  if (message.method?.startsWith("notifications/")) return;

  try {
    const result = await dispatch(message);
    write({ jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: {
        code: error.code || -32603,
        message: error.message || "Internal error",
        data: error.data,
      },
    });
  }
});

async function dispatch(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: message.params?.protocolVersion || "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: "mcp-pocketbase-proyectos-sfvc",
          version: "0.1.0",
        },
      };

    case "ping":
      return {};

    case "tools/list":
      return { tools };

    case "tools/call": {
      const name = message.params?.name;
      const handler = toolHandlers[name];
      if (!handler) throw rpcError(-32601, `Unknown tool: ${name}`);
      const value = await handler(message.params?.arguments || {});
      return toToolResult(value);
    }

    case "resources/list":
      return {
        resources: [
          {
            uri: "pocketbase://proyectos-sfvc/connection",
            name: "Proyectos SFVC PocketBase connection",
            description: "Current PocketBase URL and sanitized auth state.",
            mimeType: "application/json",
          },
          {
            uri: "pocketbase://proyectos-sfvc/schema",
            name: "Proyectos SFVC schema status",
            description: "Expected collection names and fields for this project.",
            mimeType: "application/json",
          },
        ],
      };

    case "resources/read":
      if (message.params?.uri === "pocketbase://proyectos-sfvc/connection") {
        return {
          contents: [
            {
              uri: "pocketbase://proyectos-sfvc/connection",
              mimeType: "application/json",
              text: JSON.stringify(await toolHandlers.whoami(), null, 2),
            },
          ],
        };
      }

      if (message.params?.uri === "pocketbase://proyectos-sfvc/schema") {
        return {
          contents: [
            {
              uri: "pocketbase://proyectos-sfvc/schema",
              mimeType: "application/json",
              text: JSON.stringify(await toolHandlers.validate_proyectos_schema(), null, 2),
            },
          ],
        };
      }

      throw rpcError(-32602, `Unknown resource: ${message.params?.uri}`);

    default:
      throw rpcError(-32601, `Unknown method: ${message.method}`);
  }
}

async function authenticate() {
  const pb = await getPocketBase();
  if (pb.authStore.isValid || authAttempted) return pb;
  if (authPromise) {
    await authPromise;
    return pb;
  }

  authPromise = authenticateOnce(pb);

  try {
    await authPromise;
  } finally {
    authAttempted = true;
    authPromise = null;
  }

  return pb;
}

async function authenticateOnce(pb) {
  if (process.env.POCKETBASE_ADMIN_TOKEN || process.env.PB_AUTH_TOKEN) {
    pb.authStore.save(process.env.POCKETBASE_ADMIN_TOKEN || process.env.PB_AUTH_TOKEN, null);
    return pb;
  }

  const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL;
  const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    if (pb.admins?.authWithPassword) {
      try {
        await pb.admins.authWithPassword(adminEmail, adminPassword);
        return pb;
      } catch (error) {
        if (error?.status && error.status !== 400 && error.status !== 404) {
          throw error;
        }
      }
    }

    await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);
    return pb;
  }

  if (process.env.PB_AUTH_EMAIL && process.env.PB_AUTH_PASSWORD) {
    await pb
      .collection(process.env.PB_AUTH_COLLECTION || "users")
      .authWithPassword(process.env.PB_AUTH_EMAIL, process.env.PB_AUTH_PASSWORD);
  }

  return pb;
}

async function adminApi(path, options = {}) {
  const pb = await authenticate();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (pb.authStore.token) {
    headers.set("Authorization", `Bearer ${pb.authStore.token}`);
  }

  const response = await fetch(`${PB_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const detail = await response.json().catch(async () => ({ message: await response.text() }));
    throw rpcError(-32000, `PocketBase ${response.status}: ${detail.message || "Request failed"}`, detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getPocketBase() {
  if (pbInstance) return pbInstance;

  try {
    const { default: PocketBase } = await import("pocketbase");
    pbInstance = new PocketBase(PB_URL);
    pbInstance.autoCancellation(false);
    return pbInstance;
  } catch (error) {
    throw rpcError(
      -32000,
      `Could not load the PocketBase SDK. Run "pnpm install" in the project before using this MCP. Detail: ${error.message}`,
    );
  }
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (!key || process.env[key] !== undefined) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function pick(source, keys) {
  return keys.reduce((result, key) => {
    if (source?.[key] !== undefined && source[key] !== "") result[key] = source[key];
    return result;
  }, {});
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requireString(args, key) {
  if (typeof args?.[key] !== "string" || args[key].trim() === "") {
    throw rpcError(-32602, `Missing required string argument: ${key}`);
  }
}

function requireObject(args, key) {
  if (!args?.[key] || typeof args[key] !== "object" || Array.isArray(args[key])) {
    throw rpcError(-32602, `Missing required object argument: ${key}`);
  }
}

function sanitizeAuthModel(model) {
  if (!model) return null;
  const safeModel = { ...model };
  delete safeModel.password;
  delete safeModel.tokenKey;
  return safeModel;
}

function toToolResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  return error;
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
