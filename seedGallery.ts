import { supabase } from "./server/lib/supabaseClient";

const galleryImages = [
  { url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80", caption: "Hotel Exterior & Resort" },
  { url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80", caption: "Luxury Suite Bedroom" },
  { url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&q=80", caption: "Tropical Swimming Pool" },
  { url: "https://images.unsplash.com/photo-1551882547-ff40c0d13c90?auto=format&fit=crop&q=80", caption: "Fine Dining Restaurant" },
  { url: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&q=80", caption: "Premium Executive Room" },
  { url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80", caption: "Spa & Wellness Center" },
  { url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80", caption: "Lobby & Lounge Area" },
  { url: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&q=80", caption: "Business Conference Hall" }
];

async function seedGallery() {
  console.log("Seeding gallery table with high-quality hotel images...");
  
  // First, check if there are any existing images to avoid duplicates
  const { data: existing, error: fetchError } = await supabase.from("gallery").select("id").limit(1);
  if (fetchError) {
    console.error("Failed to check existing gallery images. Did you create the table in Supabase?", fetchError);
    return;
  }
  
  if (existing && existing.length > 0) {
    console.log("Gallery table already contains images. Skipping seed to prevent duplicates.");
    return;
  }
  
  // Insert images
  const { error: insertError } = await supabase.from("gallery").insert(galleryImages);
  
  if (insertError) {
    console.error("Failed to insert gallery images:", insertError);
  } else {
    console.log("✅ Successfully seeded 8 beautiful hotel images into the gallery table!");
  }
}

seedGallery();
