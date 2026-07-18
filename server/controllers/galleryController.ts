import { Request, Response } from "express";
import { supabase } from "../lib/supabaseClient";

// Public: Get all gallery images
export const getGallery = async (_req: Request, res: Response): Promise<any> => {
  try {
    const { data: images, error } = await supabase
      .from("gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase gallery fetch error:", error);
      return res.status(500).json({ success: false, error: "Failed to load gallery images" });
    }

    return res.json({ success: true, images });
  } catch (error) {
    console.error("Gallery get error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// Admin: Add a new gallery image
export const addGalleryImage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { url, caption } = req.body;
    
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "Image URL is required" });
    }

    const { data: image, error } = await supabase
      .from("gallery")
      .insert([{ url, caption: caption || "" }])
      .select()
      .single();

    if (error) {
      console.error("Supabase gallery insert error:", error);
      return res.status(500).json({ success: false, error: "Failed to add gallery image" });
    }

    return res.status(201).json({ success: true, image });
  } catch (error) {
    console.error("Gallery add error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// Admin: Delete a gallery image
export const deleteGalleryImage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: "Image ID is required" });
    }

    const { error } = await supabase
      .from("gallery")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase gallery delete error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete gallery image" });
    }

    return res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Gallery delete error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
