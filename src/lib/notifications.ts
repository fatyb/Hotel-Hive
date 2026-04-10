/**
 * Notifies all managers + reception of a hotel when a room changes status.
 * Uses the /api/notify-room route (service role) to bypass RLS restrictions.
 */
export async function notifyRoomStatusChange(
  hotelId: string,
  roomNumber: string,
  newStatus: string,
  taskId?: string,
) {
  if (!hotelId || !roomNumber || !newStatus) return;

  try {
    await fetch("/api/notify-room", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ hotelId, roomNumber, newStatus, taskId }),
    });
  } catch {
    // Non-critical — never break the main flow
  }
}
