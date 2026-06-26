import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const apiKey = await prisma.apiKey.update({
    where: { id },
    data: {
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
      ...(body.name && { name: body.name }),
    },
  });

  return NextResponse.json(apiKey);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
