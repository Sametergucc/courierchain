// lib/fileDb.ts — Hybrid DB: Upstash Redis (when env vars exist) + JSON-seeded
// in-memory fallback (for local dev without Redis).
// All API methods are async.
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

export interface DBUser {
  id: string;
  wallet: string;
  role: "customer" | "courier";
  name: string;
  priceSOL?: number;
  available?: boolean;
  rating?: number;
  deliveries?: number;
  distance?: string;
  lat?: number;
  lng?: number;
  createdAt: number;
}

export interface DBJob {
  id: string;
  customerWallet: string;
  customerName: string;
  courierWallet: string;
  courierName: string;
  amountSOL: number;
  jobHash: string;
  txSignature: string;
  status: "escrowed" | "picked_up" | "delivered" | "cancelled";
  rentalType: string;
  createdAt: number;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  pickupAddress?: string;
  deliveryAddress?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

const USERS_KEY = "cc:users";
const JOBS_KEY = "cc:jobs";

const HAS_REDIS =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

const redis = HAS_REDIS
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

const IS_READONLY_FS =
  !!process.env.VERCEL || process.env.NODE_ENV === "production";

/* ── Seed loader (used to bootstrap empty Redis or in-memory fallback) ── */
function loadSeed<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

/* ── In-memory store (used only when Redis is not configured) ── */
type Store = { users: DBUser[]; jobs: DBJob[] };

declare global {
  // eslint-disable-next-line no-var
  var __cc_store: Store | undefined;
}

function memStore(): Store {
  if (!globalThis.__cc_store) {
    globalThis.__cc_store = {
      users: loadSeed<DBUser>(USERS_FILE),
      jobs: loadSeed<DBJob>(JOBS_FILE),
    };
  }
  return globalThis.__cc_store;
}

function persistMemUsersToDisk(users: DBUser[]) {
  if (IS_READONLY_FS) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}

function persistMemJobsToDisk(jobs: DBJob[]) {
  if (IS_READONLY_FS) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}

/* ── Redis helpers ── */
async function redisGetUsers(): Promise<DBUser[]> {
  if (!redis) return memStore().users;
  const raw = await redis.get<DBUser[] | string>(USERS_KEY);
  if (raw == null) {
    const seed = loadSeed<DBUser>(USERS_FILE);
    if (seed.length > 0) await redis.set(USERS_KEY, JSON.stringify(seed));
    return seed;
  }
  return typeof raw === "string" ? (JSON.parse(raw) as DBUser[]) : raw;
}

async function redisSetUsers(users: DBUser[]): Promise<void> {
  if (!redis) {
    memStore().users = users;
    persistMemUsersToDisk(users);
    return;
  }
  await redis.set(USERS_KEY, JSON.stringify(users));
}

async function redisGetJobs(): Promise<DBJob[]> {
  if (!redis) return memStore().jobs;
  const raw = await redis.get<DBJob[] | string>(JOBS_KEY);
  if (raw == null) {
    const seed = loadSeed<DBJob>(JOBS_FILE);
    if (seed.length > 0) await redis.set(JOBS_KEY, JSON.stringify(seed));
    return seed;
  }
  return typeof raw === "string" ? (JSON.parse(raw) as DBJob[]) : raw;
}

async function redisSetJobs(jobs: DBJob[]): Promise<void> {
  if (!redis) {
    memStore().jobs = jobs;
    persistMemJobsToDisk(jobs);
    return;
  }
  await redis.set(JOBS_KEY, JSON.stringify(jobs));
}

/* ── Public API ── */
export const fileDb = {
  users: {
    all: async (): Promise<DBUser[]> => redisGetUsers(),

    findById: async (id: string): Promise<DBUser | null> => {
      const all = await redisGetUsers();
      return all.find((u) => u.id === id) ?? null;
    },

    findByWallet: async (wallet: string): Promise<DBUser | null> => {
      const all = await redisGetUsers();
      return all.find((u) => u.wallet === wallet) ?? null;
    },

    allCouriers: async (): Promise<DBUser[]> => {
      const all = await redisGetUsers();
      return all.filter((u) => u.role === "courier");
    },

    upsert: async (user: DBUser): Promise<DBUser> => {
      const all = await redisGetUsers();
      const filtered = all.filter((u) => u.id !== user.id);
      await redisSetUsers([...filtered, user]);
      return user;
    },

    updateById: async (
      id: string,
      patch: Partial<DBUser>
    ): Promise<DBUser | null> => {
      const all = await redisGetUsers();
      const idx = all.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      const updated = { ...all[idx], ...patch };
      const next = [...all];
      next[idx] = updated;
      await redisSetUsers(next);
      return updated;
    },

    delete: async (id: string): Promise<boolean> => {
      const all = await redisGetUsers();
      const filtered = all.filter((u) => u.id !== id);
      if (filtered.length === all.length) return false;
      await redisSetUsers(filtered);
      return true;
    },
  },

  jobs: {
    all: async (): Promise<DBJob[]> => redisGetJobs(),

    byId: async (id: string): Promise<DBJob | null> => {
      const all = await redisGetJobs();
      return all.find((j) => j.id === id) ?? null;
    },

    byCourier: async (wallet: string): Promise<DBJob[]> => {
      const all = await redisGetJobs();
      return all.filter((j) => j.courierWallet === wallet);
    },

    byCustomer: async (wallet: string): Promise<DBJob[]> => {
      const all = await redisGetJobs();
      return all.filter((j) => j.customerWallet === wallet);
    },

    insert: async (job: DBJob): Promise<DBJob> => {
      const all = await redisGetJobs();
      await redisSetJobs([...all, job]);
      return job;
    },

    updateStatus: async (
      id: string,
      status: DBJob["status"],
      txSig?: string
    ): Promise<DBJob | null> => {
      const all = await redisGetJobs();
      const idx = all.findIndex((j) => j.id === id);
      if (idx === -1) return null;
      const updated = {
        ...all[idx],
        status,
        ...(txSig ? { txSignature: txSig } : {}),
      };
      const next = [...all];
      next[idx] = updated;
      await redisSetJobs(next);
      return updated;
    },
  },
};
