import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const adminId = await getAuthAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { logs: true } },
    },
  });

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const adminId = await getAuthAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  const key = `net_${uuidv4().replace(/-/g, "")}`;

  const apiKey = await prisma.apiKey.create({
    data: { name, key },
  });

  return NextResponse.json(apiKey, { status: 201 });
}
