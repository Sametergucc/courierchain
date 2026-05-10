// app/api/jobs/route.ts — Job CRUD
import { NextRequest, NextResponse } from "next/server";
import { fileDb } from "@/lib/fileDb";

// GET /api/jobs — tüm işleri listele, opsiyonel filtre
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courier = searchParams.get("courier");
    const customer = searchParams.get("customer");

    let jobs = await fileDb.jobs.all();

    if (courier) {
      jobs = jobs.filter((j) => j.courierWallet === courier);
    }
    if (customer) {
      jobs = jobs.filter((j) => j.customerWallet === customer);
    }

    return NextResponse.json({ jobs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/jobs — yeni iş oluştur
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerWallet,
      customerName,
      courierWallet,
      courierName,
      amountSOL,
      rentalType,
      jobHash,
      txSignature,
    } = body;

    if (!customerWallet || !courierWallet) {
      return NextResponse.json(
        { error: "customerWallet ve courierWallet gerekli" },
        { status: 400 }
      );
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const job = {
      id: jobId,
      customerWallet,
      customerName: customerName || "Müşteri",
      courierWallet,
      courierName: courierName || "Kurye",
      amountSOL: amountSOL || 0,
      jobHash: jobHash || `hash_${jobId}`,
      txSignature: txSignature || `demo_${jobId}`,
      status: "escrowed" as const,
      rentalType: rentalType || "daily",
      createdAt: Date.now(),
    };

    await fileDb.jobs.insert(job);
    return NextResponse.json({ job });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/jobs — iş durumu güncelle
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, txSignature } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id ve status gerekli" }, { status: 400 });
    }

    const updated = await fileDb.jobs.updateStatus(id, status, txSignature);
    if (!updated) {
      return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ job: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
