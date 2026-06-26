import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateToNativeEnglish } from "@/lib/translate";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const apiKeyHeader = request.headers.get("x-api-key");
  if (!apiKeyHeader) {
    return NextResponse.json(
      { error: "Missing API key. Provide it via x-api-key header." },
      { status: 401 }
    );
  }

  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKeyHeader },
  });

  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  if (!apiKeyRecord.isActive) {
    return NextResponse.json(
      { error: "API key is disabled." },
      { status: 403 }
    );
  }

  let body: { text?: string; history?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { text, history } = body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "\"text\" field is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  if (text.length > 5000) {
    return NextResponse.json(
      { error: "Text must be 5000 characters or less." },
      { status: 400 }
    );
  }

  // history is optional, accept any string (plain text, HTML, DOM dump, etc.)
  if (history !== undefined && typeof history !== "string") {
    return NextResponse.json(
      { error: "\"history\" must be a string." },
      { status: 400 }
    );
  }

  try {
    const translated = await translateToNativeEnglish(text, history);
    const responseTime = Date.now() - startTime;

    await prisma.apiLog.create({
      data: {
        apiKeyId: apiKeyRecord.id,
        inputText: text,
        outputText: translated,
        status: "success",
        responseTime,
      },
    });

    return NextResponse.json({
      original: text,
      translated,
      responseTime,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    await prisma.apiLog.create({
      data: {
        apiKeyId: apiKeyRecord.id,
        inputText: text,
        outputText: "",
        status: "error",
        responseTime,
      },
    });

    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed. Please try again later." },
      { status: 500 }
    );
  }
}
