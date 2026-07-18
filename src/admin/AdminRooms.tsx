import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { toast } from "react-toastify";
import { PlusCircle, Edit, Trash2, X } from "lucide-react";
import { API_URL } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { revealSoft, revealUp, sectionStagger } from "../lib/animations";

const defaultFormState = {
  title: "",
  description: "",
  price: "",
  images: [""],
  roomType: "Deluxe Room",
  capacity: "2",
  availableRooms: "1",
};

export default function AdminRooms() {
  const { adminToken } = useContext(AuthContext);
  const [rooms, setRooms] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(defaultFormState);

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setEditingRoom(null);
    setFormData(defaultFormState);
  };

  const handleEdit = (room: any) => {
    setEditingRoom(room);
    setFormData({
      title: room.title,
      description: room.description,
      price: room.price.toString(),
      images: room.images || [""],
      roomType: room.roomType,
      capacity: room.capacity.toString(),
      availableRooms: room.availableRooms.toString(),
    });
    setShowModal(true);
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        images: formData.images.filter((img) => img && img.trim() !== ""),
        price: Number(formData.price),
        capacity: Number(formData.capacity),
        room_type: formData.roomType,
        available_rooms: Number(formData.availableRooms),
        amenities: ["Free WiFi", "TV", "AC"],
      };

      if (editingRoom) {
        const { data } = await axios.put(`${API_URL}/api/rooms/${editingRoom.id}`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (data.success) {
          toast.success("Room updated successfully");
          setShowModal(false);
          resetForm();
          fetchRooms();
        }
      } else {
        const { data } = await axios.post(`${API_URL}/api/rooms`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (data.success) {
          toast.success("Room added successfully");
          setShowModal(false);
          resetForm();
          fetchRooms();
        }
      }
    } catch (err) {
      toast.error(editingRoom ? "Failed to update room" : "Failed to add room");
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/rooms`);
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (err) {
      toast.error("Failed to load rooms");
    }
  };

  const deleteRoom = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await axios.delete(`${API_URL}/api/rooms/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      toast.success("Room deleted");
      fetchRooms();
    } catch (err) {
      toast.error("Failed to delete room");
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionStagger} className="max-w-7xl mx-auto">
      <motion.div variants={revealUp} className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Manage Rooms</h1>
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-slate-800"
        >
          <PlusCircle className="w-5 h-5" /> Add New Room
        </motion.button>
      </motion.div>

      <motion.div
        variants={revealSoft}
        className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
      >
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Room Info</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Capacity</th>
              <th className="px-6 py-4 font-semibold">Price/Night</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {rooms.map((room, index) => (
              <motion.tr
                key={room.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.03 }}
                className="transition-colors hover:bg-slate-50"
              >
                <td className="px-6 py-4">
                  <div className="text-base font-semibold text-slate-900">{room.title}</div>
                  <div className="max-w-xs line-clamp-1 text-slate-500">{room.description}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-600">
                    {room.roomType}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{room.capacity} Guests</td>
                <td className="px-6 py-4 font-bold text-slate-900">Rs. {room.price.toLocaleString("en-IN")}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEdit(room)}
                      className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors hover:text-blue-800"
                    >
                      <Edit className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => deleteRoom(room.id)}
                      className="rounded-lg bg-red-50 p-2 text-red-600 transition-colors hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {rooms.length === 0 && (
          <motion.div variants={revealSoft} className="py-12 text-center text-lg text-slate-500">
            No rooms available yet. Add some rooms to get started.
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">{editingRoom ? "Edit Room" : "Add New Room"}</h2>
                <motion.button
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <form onSubmit={handleAddRoom} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Title</label>
                    <input
                      required
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Room Type</label>
                    <select
                      required
                      name="roomType"
                      value={formData.roomType}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2"
                    >
                      <option value="Deluxe Room">Deluxe Room</option>
                      <option value="Executive Room">Executive Room</option>
                      <option value="Family Suite">Family Suite</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <textarea
                    required
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full rounded-lg border p-2"
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Price</label>
                    <input
                      required
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Capacity</label>
                    <input
                      required
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Available Rooms</label>
                    <input
                      required
                      type="number"
                      name="availableRooms"
                      value={formData.availableRooms}
                      onChange={handleChange}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Image Network URLs</label>
                  <div className="space-y-3">
                    <input
                      required
                      type="url"
                      value={formData.images[0] || ""}
                      onChange={(e) => {
                        const newImages = [...formData.images];
                        newImages[0] = e.target.value;
                        setFormData({ ...formData, images: newImages });
                      }}
                      placeholder="Primary Image (Required) - https://..."
                      className="w-full rounded-lg border p-2"
                    />
                    {[1, 2, 3].map((index) => (
                      <input
                        key={index}
                        type="url"
                        value={formData.images[index] || ""}
                        onChange={(e) => {
                          const newImages = [...formData.images];
                          newImages[index] = e.target.value;
                          setFormData({ ...formData, images: newImages });
                        }}
                        placeholder={`Optional Image ${index} - https://...`}
                        className="w-full rounded-lg border p-2"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : editingRoom ? "Update Room" : "Save Room"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

