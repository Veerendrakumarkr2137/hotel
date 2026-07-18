import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { API_URL } from "../lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
};

type GalleryImage = {
  id: string;
  url: string;
  caption: string;
};

export default function Gallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/gallery`);
        const data = await res.json();
        if (res.ok && data.success) {
          setImages(data.images || []);
        }
      } catch (error) {
        console.error("Failed to fetch gallery images", error);
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, []);

  return (
    <div className="container mx-auto px-4 py-20 max-w-7xl min-h-[70vh]">
      <div className="text-center mb-16 px-4">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 text-slate-900 tracking-tight"
        >
          Visual <span className="text-blue-600">Journey</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed"
        >
          Explore the spaces and atmosphere that define Ashok Inn.
        </motion.p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p>No images available in the gallery yet.</p>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {images.map((image, idx) => (
            <motion.div 
              key={image.id} 
              variants={itemVariants}
              whileHover={{ y: -10 }}
              className="group relative overflow-hidden rounded-[2rem] aspect-[4/3] bg-slate-100 cursor-pointer shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500"
            >
              <img 
                src={image.url} 
                alt={image.caption || `Gallery ${idx + 1}`} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                <span className="text-white font-bold text-lg tracking-wide uppercase">
                  {image.caption || `Hotel Highlight ${idx + 1}`}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
