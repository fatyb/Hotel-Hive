import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const STATUS_LABELS: Record<string, string> = {
  disponible:  "Disponible",
  nettoyage:   "Nettoyage",
  maintenance: "Maintenance",
  occupee:     "Occupée",
};

export async function POST(req: NextRequest) {
  try {
    const { hotelId, roomNumber, newStatus, taskId } = await req.json();

    if (!hotelId || !roomNumber || !newStatus) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Service key missing." }, { status: 500 });
    }

    // Service role client — bypasses RLS, can insert for any user_id
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find all managers + reception staff for this hotel
    const { data: recipients } = await supabase
      .from("profiles")
      .select("id")
      .eq("hotel_id", hotelId)
      .in("role", ["manager", "reception"]);

    if (!recipients?.length) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const label   = STATUS_LABELS[newStatus] ?? newStatus;
    const isReady = newStatus === "disponible";

    const title   = isReady
      ? `Chambre ${roomNumber} — Disponible ✓`
      : `Chambre ${roomNumber} — ${label}`;
    const message = isReady
      ? `La chambre ${roomNumber} a été nettoyée et est maintenant disponible.`
      : `La chambre ${roomNumber} est passée au statut "${label}".`;

    const { error } = await supabase.from("notifications").insert(
      recipients.map((r) => ({
        hotel_id: hotelId,
        user_id:  r.id,
        type:     isReady ? "room_ready" : "task_assigned",
        title,
        message,
        data:     { room_number: roomNumber, status: newStatus, ...(taskId ? { task_id: taskId } : {}) },
        is_read:  false,
      }))
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent: recipients.length });
  } catch (e) {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
