import { NextResponse } from "next/server";
import { removeAgent } from "@/lib/store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await removeAgent(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove agent" }, { status: 500 });
  }
}
