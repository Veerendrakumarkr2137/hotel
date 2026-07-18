import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { Users, Building, ClipboardList, IndianRupee, ShieldCheck, LogIn, LogOut } from "lucide-react";
import { API_URL } from "../lib/api";
import { motion } from "motion/react";
import { hoverLift, revealSoft, revealUp, sectionStagger } from "../lib/animations";

type DashboardStats = {
  revenue: number;
  totalBookings: number;
  totalRooms: number;
  totalUsers: number;
  adminCount: number;
  guestCount: number;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt?: string;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { adminToken, isLoading } = useContext(AuthContext);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoadError("");
        const { data } = await axios.get(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (data.success) {
          setStats(data.stats);
          setRecentUsers(data.recentUsers || []);
        } else {
          setLoadError("Failed to load dashboard data.");
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
        setLoadError("Failed to load dashboard data. Please try signing in again.");
      }
    };

    if (isLoading) {
      return;
    }

    if (!adminToken) {
      navigate("/admin", { replace: true });
      return;
    }

    fetchDashboardData();
  }, [adminToken, isLoading, navigate]);

  if (isLoading || (!stats && !loadError)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4], y: [0, -6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-500 shadow-sm"
        >
          Loading dashboard...
        </motion.div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-medium text-red-700 shadow-sm">
          {loadError}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Revenue (Rs.)",
      value: stats.revenue.toLocaleString("en-IN"),
      icon: IndianRupee,
      color: "bg-emerald-100 text-emerald-600",
    },
    { label: "Total Bookings", value: stats.totalBookings, icon: ClipboardList, color: "bg-blue-100 text-blue-600" },
    { label: "Total Rooms", value: stats.totalRooms, icon: Building, color: "bg-purple-100 text-purple-600" },
    { label: "Registered Users", value: stats.totalUsers, icon: Users, color: "bg-amber-100 text-amber-600" },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionStagger} className="max-w-7xl mx-auto">
      <motion.h1 variants={revealUp} className="mb-8 text-3xl font-bold text-slate-900">
        Dashboard Overview
      </motion.h1>

      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              variants={revealSoft}
              whileHover={hoverLift}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div>
                <p className="mb-1 text-sm font-medium text-slate-500">{stat.label}</p>
                <h3 className="text-3xl font-bold text-slate-900">{stat.value}</h3>
              </div>
              <div className={`rounded-xl p-4 ${stat.color}`}>
                <Icon className="w-8 h-8" />
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div variants={revealSoft} className="mb-8 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-bold text-slate-900">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <motion.div whileHover={hoverLift}>
            <Link
              to="/admin/rooms"
              className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 transition-colors hover:bg-blue-100"
            >
              <Building className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Manage Rooms</h3>
                <p className="text-sm text-slate-600">Add, edit, or delete rooms</p>
              </div>
            </Link>
          </motion.div>

          <motion.div whileHover={hoverLift}>
            <Link
              to="/admin/check-in"
              className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 transition-colors hover:bg-sky-100"
            >
              <LogIn className="w-6 h-6 text-sky-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Check-In Desk</h3>
                <p className="text-sm text-slate-600">Move arrivals to checked in</p>
              </div>
            </Link>
          </motion.div>

          <motion.div whileHover={hoverLift}>
            <Link
              to="/admin/check-out"
              className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 transition-colors hover:bg-indigo-100"
            >
              <LogOut className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Check-Out Desk</h3>
                <p className="text-sm text-slate-600">Close stays after departure</p>
              </div>
            </Link>
          </motion.div>

          <motion.div whileHover={hoverLift}>
            <Link
              to="/admin/bookings"
              className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 transition-colors hover:bg-green-100"
            >
              <ClipboardList className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-slate-900">Manage Bookings</h3>
                <p className="text-sm text-slate-600">View and update bookings</p>
              </div>
            </Link>
          </motion.div>

        </div>
      </motion.div>

      <motion.div
        variants={revealSoft}
        className="mb-8 flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-6"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
          <Users className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">User Overview</h3>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-purple-700">
              {stats.totalUsers} total
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-white/80 px-2.5 py-1">
              {stats.guestCount} guest{stats.guestCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
              {stats.adminCount} admin{stats.adminCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {recentUsers.length > 0 ? (
              recentUsers.map((user) => (
                <div key={user.id} className="truncate text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{user.name}</span>
                  {" - "}
                  <span className="truncate">{user.email}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No registered users yet.</p>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={revealSoft} className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Recent Activity</h2>
        <p className="text-slate-500">More detailed charts and tables will be added here in future updates.</p>
      </motion.div>
    </motion.div>
  );
}

