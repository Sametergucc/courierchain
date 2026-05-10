// lib/db.ts — Client-side API wrapper
// Tüm veri artık API üzerinden JSON dosyalarından geliyor

export type UserRole = "customer" | "courier";

export interface DBUser {
  id: string;
  wallet: string;
  role: UserRole;
  name: string;
  createdAt: number;
  priceSOL?: number;
  available?: boolean;
  rating?: number;
  deliveries?: number;
  distance?: string;
  lat?: number;
  lng?: number;
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

/* ── API-based database ── */
export const db = {
  users: {
    /** Register or login via API */
    register: async (
      name: string,
      role: UserRole,
      wallet?: string,
      priceSOL?: number
    ): Promise<DBUser> => {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, wallet, priceSOL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.user;
    },

    /** Get all couriers */
    allCouriers: async (): Promise<DBUser[]> => {
      const res = await fetch("/api/couriers");
      const data = await res.json();
      return data.couriers || [];
    },

    /** Update courier */
    updateCourier: async (id: string, patch: Partial<DBUser>): Promise<DBUser> => {
      const res = await fetch("/api/couriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.courier;
    },
  },

  jobs: {
    /** Get all jobs, optionally filtered */
    all: async (filter?: { courier?: string; customer?: string }): Promise<DBJob[]> => {
      const params = new URLSearchParams();
      if (filter?.courier) params.set("courier", filter.courier);
      if (filter?.customer) params.set("customer", filter.customer);
      const res = await fetch(`/api/jobs?${params.toString()}`);
      const data = await res.json();
      return data.jobs || [];
    },

    /** Create a new job */
    create: async (job: Omit<DBJob, "id" | "createdAt" | "status">): Promise<DBJob> => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.job;
    },

    /** Update job status */
    updateStatus: async (
      id: string,
      status: DBJob["status"],
      txSignature?: string
    ): Promise<DBJob> => {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, txSignature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.job;
    },
  },
};
