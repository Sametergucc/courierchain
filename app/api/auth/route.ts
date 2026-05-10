// app/api/auth/route.ts — Register / Login
import { NextRequest, NextResponse } from "next/server";
import { fileDb, DBUser } from "@/lib/fileDb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, role, wallet, priceSOL } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "name ve role gerekli" }, { status: 400 });
    }

    // Wallet varsa kullan, yoksa random ID üret
    const userWallet = wallet || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Var olan kullanıcıyı kontrol et (wallet ile)
    const existing = await fileDb.users.findByWallet(userWallet);
    if (existing) {
      return NextResponse.json({ user: existing });
    }

    // Yeni kullanıcı oluştur
    const newUser: DBUser = {
      id: userId,
      wallet: userWallet,
      role,
      name: name.trim(),
      createdAt: Date.now(),
      ...(role === "courier"
        ? {
            priceSOL: parseFloat(priceSOL) || 0.08,
            available: true,
            rating: 0,
            deliveries: 0,
            distance: "—",
            lat: 41.008 + (Math.random() - 0.5) * 0.02,
            lng: 28.978 + (Math.random() - 0.5) * 0.02,
          }
        : {}),
    };

    await fileDb.users.upsert(newUser);
    return NextResponse.json({ user: newUser });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
