import { Request, Response } from "express";
import { supabase } from "../lib/supabaseClient";
import { ensureDefaultRooms } from "../lib/ensureDefaultRooms";
import { adaptRoom } from "../lib/adapters";

export const getRooms = async (req: Request, res: Response): Promise<any> => {
  try {
    let { data: rooms, error } = await supabase
      .from("rooms")
      .select("*");

    if (error) throw error;

    if (!rooms || rooms.length === 0) {
      await ensureDefaultRooms();
      const { data: seededRooms, error: seededError } = await supabase
        .from("rooms")
        .select("*");
      if (seededError) throw seededError;
      rooms = seededRooms;
    }

    const adaptedRooms = (rooms || []).map(adaptRoom);
    return res.json({ success: true, rooms: adaptedRooms });
  } catch (error: any) {
    console.error("Fetch rooms error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to fetch rooms" });
  }
};

export const getRoomById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, room: adaptRoom(room) });
  } catch (error: any) {
    console.error("Fetch room by id error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to fetch room" });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data: room, error } = await supabase
      .from("rooms")
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, room: adaptRoom(room) });
  } catch (error: any) {
    console.error("Create room error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to create room" });
  }
};

export const updateRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data: room, error } = await supabase
      .from("rooms")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, room: adaptRoom(room) });
  } catch (error: any) {
    console.error("Update room error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to update room" });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data: room, error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, message: "Room deleted" });
  } catch (error: any) {
    console.error("Delete room error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to delete room" });
  }
};
