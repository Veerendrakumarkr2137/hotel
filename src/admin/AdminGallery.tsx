import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { API_URL } from "../lib/api";
import { getAdminToken, createAuthHeaders } from "../lib/auth";

type GalleryImage = {
  id: string;
  url: string;
  caption: string;
};

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchImages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gallery`);
      const data = await res.json();
      if (res.ok && data.success) {
        setImages(data.images || []);
      }
    } catch (error) {
      toast.error("Failed to fetch gallery images.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return toast.error("Image URL is required.");

    const token = getAdminToken();
    if (!token) return toast.error("Not authenticated");

    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/gallery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createAuthHeaders(token)
        },
        body: JSON.stringify({ url: newUrl, caption: newCaption })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Image added to gallery!");
        setImages([data.image, ...images]);
        setNewUrl("");
        setNewCaption("");
      } else {
        toast.error(data.error || "Failed to add image");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this image from the gallery?")) return;

    const token = getAdminToken();
    if (!token) return toast.error("Not authenticated");

    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/gallery/${id}`, {
        method: "DELETE",
        headers: createAuthHeaders(token)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Image removed from gallery!");
        setImages(images.filter((img) => img.id !== id));
      } else {
        toast.error(data.error || "Failed to delete image");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Manage Gallery</h1>
        <p className="mt-2 text-slate-600">Add or remove images from the public gallery page.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Add New Image</h2>
        <form onSubmit={handleAddImage} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Image URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Caption (Optional)</label>
            <input
              type="text"
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="e.g. Hotel Highlight"
              className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={adding}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400 md:w-auto"
            >
              {adding ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <>
                  <Plus className="h-5 w-5" /> Add
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-[4/3]"
          >
            <img
              src={image.url}
              alt={image.caption || "Gallery"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-black/0 to-black/30 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="flex justify-end">
                <button
                  onClick={() => handleDeleteImage(image.id)}
                  disabled={deletingId === image.id}
                  className="rounded-full bg-red-500/90 p-2 text-white transition-transform hover:scale-110 hover:bg-red-600"
                  title="Delete Image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div>
                <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
                  {image.caption || "Gallery Image"}
                </span>
              </div>
            </div>
          </div>
        ))}

        {images.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-slate-500">
            <ImageIcon className="mb-2 h-8 w-8 text-slate-400" />
            <p>No images in gallery yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
