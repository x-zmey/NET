import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken, hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  let admin = await prisma.admin.findUnique({ where: { username } });

  // Auto-create first admin if none exists
  if (!admin) {
    const adminCount = await prisma.admin.count();
    if (adminCount === 0) {
      admin = await prisma.admin.create({
        data: {
          username,
          password: await hashPassword(password),
        },
      });
    }
  }

  if (!admin) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, admin.password);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 }
    );
  }

  const token = generateToken(admin.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
