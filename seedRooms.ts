import dotenv from "dotenv";
import { supabase } from "./server/lib/supabaseClient";
import { defaultRooms } from "./server/data/defaultRooms";

dotenv.config();

async function seedDatabase() {
  try {
    console.log("Connecting to Supabase...");
    
    console.log("Clearing existing rooms...");
    // Direct delete requires a filter condition in PostgREST, so we match everything not equal to a zero UUID
    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) throw deleteError;
    
    console.log("Inserting sample rooms...");
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
    if (insertError) throw insertError;
    
    console.log("Sample rooms seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
