import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleApiRequest(request);
}

export async function POST(request: NextRequest) {
  return handleApiRequest(request);
}

export async function PATCH(request: NextRequest) {
  return handleApiRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleApiRequest(request);
}
