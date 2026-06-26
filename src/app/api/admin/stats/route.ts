import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthAdmin } from "@/lib/auth";

export async function GET() {
  const adminId = await getAuthAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalKeys, activeKeys, totalRequests, successRequests] =
    await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { isActive: true } }),
      prisma.apiLog.count(),
      prisma.apiLog.count({ where: { status: "success" } }),
    ]);

  const recentLogs = await prisma.apiLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { responseTime: true },
  });

  const avgResponseTime =
    recentLogs.length > 0
      ? Math.round(
          recentLogs.reduce((sum, l) => sum + l.responseTime, 0) /
            recentLogs.length
        )
      : 0;

  return NextResponse.json({
    totalKeys,
    activeKeys,
    totalRequests,
    successRequests,
    errorRequests: totalRequests - successRequests,
    avgResponseTime,
  });
}
