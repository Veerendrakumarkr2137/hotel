import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { LayoutDashboard, Hotel, ClipboardList, LogIn, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { easeOutExpo } from "../lib/animations";

export default function AdminSidebar() {
  const { logoutAdmin } = useContext(AuthContext);
  const location = useLocation();

  const menu = [
    { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Rooms", path: "/admin/rooms", icon: Hotel },
    { name: "Bookings", path: "/admin/bookings", icon: ClipboardList },
    { name: "Check-In", path: "/admin/check-in", icon: LogIn },
    { name: "Check-Out", path: "/admin/check-out", icon: LogOut },
    { name: "Gallery", path: "/admin/gallery", icon: Hotel },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: easeOutExpo }}
      className="flex h-full w-64 flex-col bg-slate-900 pt-8 text-white"
    >
      <div className="mb-12 px-6">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Admin<span className="text-blue-500">Panel</span>
        </h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Ashok Inn
        </p>
      </div>

      <nav className="flex-1 space-y-2 px-4">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.includes(item.path);

          return (
            <motion.div key={item.name} whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-800 p-4">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={logoutAdmin}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 font-semibold text-red-500 transition-colors hover:bg-red-500/20"
        >
          <LogOut className="w-5 h-5" />
          Logout Admin
        </motion.button>
      </div>
    </motion.div>
  );
}
