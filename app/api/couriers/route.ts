// app/api/couriers/route.ts — Courier CRUD
import { NextRequest, NextResponse } from "next/server";
import { fileDb, DBUser } from "@/lib/fileDb";

// GET /api/couriers — tüm kuryeleri listele
export async function GET() {
  try {
    const couriers = await fileDb.users.allCouriers();
    return NextResponse.json({ couriers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/couriers — yeni kurye ekle
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, priceSOL, wallet } = body;

    if (!name) {
      return NextResponse.json({ error: "name gerekli" }, { status: 400 });
    }

    const userWallet = wallet || `courier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newCourier: DBUser = {
      id: userId,
      wallet: userWallet,
      role: "courier",
      name: name.trim(),
      priceSOL: parseFloat(priceSOL) || 0.08,
      available: true,
      rating: 0,
      deliveries: 0,
      distance: "—",
      lat: 41.008 + (Math.random() - 0.5) * 0.02,
      lng: 28.978 + (Math.random() - 0.5) * 0.02,
      createdAt: Date.now(),
    };

    await fileDb.users.upsert(newCourier);
    return NextResponse.json({ courier: newCourier });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/couriers — kurye güncelle
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body;

    if (!id) {
      return NextResponse.json({ error: "id gerekli" }, { status: 400 });
    }

    const updated = await fileDb.users.updateById(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Kurye bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ courier: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
