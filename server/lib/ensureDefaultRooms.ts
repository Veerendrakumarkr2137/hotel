import { supabase } from "./supabaseClient";
import { defaultRooms } from "../data/defaultRooms";

export async function ensureDefaultRooms() {
  try {
    const { count, error } = await supabase
      .from("rooms")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("ensureDefaultRooms count query failed:", error.message);
      return false;
    }

    const roomCount = count || 0;

    if (roomCount > 0) {
      return false;
    }

    const rows = defaultRooms.map((room) => ({
      title: room.title,
      description: room.description,
      price: room.price,
      images: room.images,
      room_type: room.roomType,
      capacity: room.capacity,
      amenities: room.amenities,
      available_rooms: room.availableRooms,
    }));

    const { error: insertError } = await supabase.from("rooms").insert(rows);

    if (insertError) {
      console.error("ensureDefaultRooms insert query failed:", insertError.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("ensureDefaultRooms error:", error);
    return false;
  }
}
