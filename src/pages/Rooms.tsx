import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { API_URL } from "../lib/api";
import { motion } from "motion/react";
import { hoverLift, revealSoft, revealUp, sectionStagger } from "../lib/animations";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

export default function Rooms() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fallbackImages = [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&q=80",
  ];

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/rooms`);
        if (data.success) {
          setRooms(data.rooms);
        }
      } catch (err) {
        console.error("Failed to fetch rooms:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4">
        <div className="motion-float absolute h-40 w-40 rounded-full bg-blue-100/80 blur-3xl" />
        <div className="motion-float-delayed absolute h-48 w-48 rounded-full bg-cyan-100/70 blur-3xl" />

        <div className="relative flex flex-col items-center gap-5 rounded-[2rem] border border-white/70 bg-white/80 px-10 py-8 shadow-2xl shadow-slate-200/70 backdrop-blur-md">
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              className="h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600"
            />
            <motion.div
              animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute h-7 w-7 rounded-full bg-blue-500/15"
            />
          </div>
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
            Loading Amazing Rooms
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-20">
      <div className="motion-float absolute left-[-4rem] top-14 h-40 w-40 rounded-full bg-blue-100/80 blur-3xl" />
      <div className="motion-float-delayed absolute right-[-3rem] top-36 h-48 w-48 rounded-full bg-cyan-100/70 blur-3xl" />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={sectionStagger}
        className="relative mb-16 px-4 text-center"
      >
        <motion.div
          variants={revealSoft}
          className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-700"
        >
          <Sparkles className="h-4 w-4" />
          Handpicked Escapes
        </motion.div>
        <motion.h1
          variants={revealUp}
          className="mt-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl"
        >
          Our Luxury <span className="text-blue-600">Rooms</span>
        </motion.h1>
        <motion.p
          variants={revealSoft}
          className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600"
        >
          Experience the pinnacle of hospitality where thoughtful design, soft details, and modern comfort come together in every stay.
        </motion.p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-3"
      >
        {rooms.map((room) => {
          const roomImages = Array.isArray(room.images)
            ? room.images.filter((img: string) => typeof img === "string" && img.trim().length > 0)
            : [];
          const heroImage = roomImages[0] || fallbackImages[0];

          return (
            <motion.div
              key={room._id}
              variants={revealSoft}
              whileHover={hoverLift}
              className="group flex flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm shadow-slate-200/50"
            >
              <div className="relative h-72 overflow-hidden">
                <img
                  src={heroImage}
                  alt={room.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-slate-950/10 to-transparent" />
                <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-700 shadow-lg backdrop-blur-md">
                  {room.roomType}
                </div>
                <div className="absolute bottom-4 right-4 rounded-2xl border border-white/70 bg-white/92 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg backdrop-blur-md">
                  Rs. {room.price.toLocaleString("en-IN")}
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    / night
                  </span>
                </div>
              </div>

            <div className="flex flex-grow flex-col p-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  {room.capacity} Guests
                </span>
              </div>

              <h2 className="text-2xl font-black leading-tight text-slate-900 transition-colors duration-300 group-hover:text-blue-600">
                {room.title}
              </h2>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-500">
                {room.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {room.amenities?.slice(0, 3).map((amenity: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600"
                  >
                    {amenity}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex gap-4 pt-8">
                <Link
                  to={`/room/${room._id}`}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 py-4 text-sm font-bold text-slate-900 transition-all hover:bg-slate-100"
                >
                  Details
                </Link>
                <Link
                  to={`/book/${room._id}`}
                  className="group/cta inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-200/70 transition-all hover:bg-blue-700"
                >
                  Book Now
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                </Link>
              </div>
            </div>
            </motion.div>
          );
        })}

        {rooms.length === 0 && !loading && (
          <motion.div
            variants={revealSoft}
            className="col-span-full rounded-[2rem] border-2 border-dashed border-slate-200 bg-white/80 py-20 text-center shadow-sm"
          >
            <p className="font-medium text-slate-400">No rooms match your criteria.</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

