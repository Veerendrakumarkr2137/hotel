import { Request, Response } from "express";
import { Room } from "../models/Room";
import { ensureDefaultRooms } from "../lib/ensureDefaultRooms";

export const getRooms = async (req: Request, res: Response): Promise<any> => {
  try {
    let rooms = await Room.find({});
    if (rooms.length === 0) {
      await ensureDefaultRooms();
      rooms = await Room.find({});
    }
    return res.json({ success: true, rooms });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch rooms" });
  }
};

export const getRoomById = async (req: Request, res: Response): Promise<any> => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, room });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch room" });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const room = await Room.create(req.body);
    return res.status(201).json({ success: true, room });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to create room" });
  }
};

export const updateRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, room });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to update room" });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, message: "Room deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to delete room" });
  }
};
