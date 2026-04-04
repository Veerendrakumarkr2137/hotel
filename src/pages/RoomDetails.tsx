import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Check, Users, Coffee, Wifi, Car, Waves, Tv, Shield } from "lucide-react";
import { API_URL } from "../lib/api";

export default function RoomDetails() {
  const { id } = useParams();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fallbackImages = [
    "https://assets.anantara.com/image/upload/q_auto,f_auto,c_limit,w_1045/media/minor/anantara/images/anantara-peace-haven-tangalle-resort/accommodation/details-page/deluxe-ocean-view-room/anantara_peace_haven_tangalle_premier_ocean_view_room_bath_intro_944x510.jpg",
    "https://www.fourseasons.com/alt/img-opt/~65.1701.0,0000-215,0231-3000,0000-1687,5000/publish/content/dam/fourseasons/images/web/BNG/BNG_768_original.jpg",
    "https://www.royaltuskersuites.com/images/uploads/54/1663224403RT-EDR-3.png?59723793?0.21859776048476365",
    "https://assets.anantara.com/image/upload/q_auto,f_auto,c_limit,w_1045/media/minor/anantara/images/anantara-peace-haven-tangalle-resort/accommodation/details-page/deluxe-ocean-view-room/anantara_peace_haven_tangalle_premier_ocean_view_room_bath_intro_944x510.jpg",
  ];

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/rooms/${id}`);
        if (data.success) {
          setRoom(data.room);
        }
      } catch (err) {
        console.error("Failed to fetch room details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [id]);

  if (loading) {
    return <div className="text-center py-20 text-xl font-medium">Loading details...</div>;
  }

  if (!room) {
    return <div className="text-center py-20 text-xl text-red-500">Room not found</div>;
  }

  const roomImages = Array.isArray(room.images)
    ? room.images.filter((img: string) => typeof img === "string" && img.trim().length > 0)
    : [];
  const galleryImages = roomImages.length > 0 ? roomImages : fallbackImages;

  return (
    <div className="container mx-auto px-4 py-16 max-w-7xl">
      <div className="grid lg:grid-cols-2 gap-12 bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100">
        
        {/* Left Col: Imagery */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100">
            <img
              src={galleryImages[0]}
              alt={room.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {galleryImages.slice(1, 4).map((img: string, i: number) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity border border-slate-200">
                <img src={img} alt={`View ${i+2}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Info */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-blue-50 text-blue-600 font-semibold px-3 py-1 rounded-full text-sm uppercase tracking-wider">
              {room.roomType}
            </span>
            <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-3 py-1 text-sm rounded-full">
              <Users className="w-4 h-4" /> {room.capacity} Guests Max
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            {room.title}
          </h1>
          
          <div className="text-3xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-8">
            ₹{room.price.toLocaleString("en-IN")}
            <span className="text-lg font-normal text-slate-500 ml-2">/ night</span>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-slate-800">Room Overview</h3>
            <p className="text-slate-600 leading-relaxed text-lg">
              {room.description}
            </p>
          </div>

          <div className="mb-10">
            <h3 className="text-xl font-semibold mb-4 text-slate-800">Premium Amenities</h3>
            <div className="grid grid-cols-2 shadow-sm rounded-2xl bg-slate-50 border border-slate-100 p-6 gap-y-4 gap-x-6">
              {room.amenities?.map((amenity: string, idx: number) => (
                <div key={idx} className="flex items-center gap-3 text-slate-700 font-medium">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-green-500 shadow-sm border border-slate-100">
                    <Check className="w-4 h-4" />
                  </div>
                  {amenity}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <Link
              to={`/book/${room._id}`}
              className="w-full flex items-center justify-center text-center bg-slate-900 text-white font-semibold py-4 rounded-xl text-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
            >
              Reserve this Room
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

