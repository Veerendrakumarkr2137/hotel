import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { CalendarDays, CheckCircle2, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { AuthContext } from "../context/AuthContext";
import { API_URL } from "../lib/api";
import { revealSoft, revealUp, sectionStagger } from "../lib/animations";
import {
  getBookingStatusClasses,
  getBookingStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusClasses,
} from "../lib/bookingUi";

type AdminBookingRecord = {
  id: string;
  bookingRef: string;
  name: string;
  email: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  bookingStatus: string;
  createdAt?: string;
  roomId?: {
    title?: string;
  };
};

function getStartOfDay(value: string | Date) {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDepartureState(checkOutDate: string) {
  const today = getStartOfDay(new Date());
  const departureDate = getStartOfDay(checkOutDate);
  const diffDays = Math.round((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      code: "overdue",
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`,
      classes: "bg-red-100 text-red-700",
    };
  }

  if (diffDays === 0) {
    return {
      code: "today",
      label: "Due Today",
      classes: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    code: "upcoming",
    label: `${diffDays} day${diffDays === 1 ? "" : "s"} left`,
    classes: "bg-indigo-100 text-indigo-700",
  };
}

function sortByDepartureDate(bookings: AdminBookingRecord[]) {
  return [...bookings].sort((left, right) => {
    const leftDeparture = new Date(left.checkOutDate).getTime();
    const rightDeparture = new Date(right.checkOutDate).getTime();

    if (leftDeparture !== rightDeparture) {
      return leftDeparture - rightDeparture;
    }

    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}

export default function AdminCheckOut() {
  const { adminToken } = useContext(AuthContext);
  const [bookings, setBookings] = useState<AdminBookingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (adminToken) {
      fetchBookings();
      return;
    }

    setLoading(false);
  }, [adminToken]);

  const fetchBookings = async () => {
    setLoading(true);

    try {
      const { data } = await axios.get(`${API_URL}/api/bookings/admin/all`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (data.success) {
        setBookings(data.bookings || []);
      }
    } catch {
      toast.error("Failed to load check-out queue");
    } finally {
      setLoading(false);
    }
  };

  const checkOutQueue = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const queue = bookings.filter((booking) => booking.bookingStatus === "checked_in");

    const filtered = normalizedQuery
      ? queue.filter((booking) =>
          booking.bookingRef.toLowerCase().includes(normalizedQuery) ||
          booking.name.toLowerCase().includes(normalizedQuery) ||
          booking.email.toLowerCase().includes(normalizedQuery) ||
          booking.phone.includes(normalizedQuery) ||
          String(booking.roomId?.title || "").toLowerCase().includes(normalizedQuery),
        )
      : queue;

    return sortByDepartureDate(filtered);
  }, [bookings, searchQuery]);

  const summary = useMemo(() => {
    const queue = bookings.filter((booking) => booking.bookingStatus === "checked_in");

    return queue.reduce(
      (stats, booking) => {
        const state = getDepartureState(booking.checkOutDate).code;

        if (state === "today") {
          stats.today += 1;
        } else if (state === "overdue") {
          stats.overdue += 1;
        } else {
          stats.upcoming += 1;
        }

        return stats;
      },
      { today: 0, overdue: 0, upcoming: 0 },
    );
  }, [bookings]);

  const handleCheckOut = async (booking: AdminBookingRecord) => {
    setUpdatingId(booking.id);

    try {
      const { data } = await axios.put(
        `${API_URL}/api/bookings/admin/${booking.id}/status`,
        { status: "completed" },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      if (data.success) {
        toast.success("Guest checked out successfully.");
        fetchBookings();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Unable to check out this booking");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionStagger} className="max-w-7xl mx-auto">
      <motion.div variants={revealUp} className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600">Front Desk</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Check-Out Desk</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            In-house guests appear here so the team can complete departure, close the stay cleanly, and release the room back into future availability.
          </p>
        </div>
        <Link
          to="/admin/bookings"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Open Full Booking List
        </Link>
      </motion.div>

      <motion.div variants={revealSoft} className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Due Today</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.today}</p>
          <p className="mt-2 text-xs font-medium text-emerald-700">Guests scheduled to depart today</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Overdue Departures</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.overdue}</p>
          <p className="mt-2 text-xs font-medium text-red-700">Stays that still need to be closed</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Upcoming Departures</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.upcoming}</p>
          <p className="mt-2 text-xs font-medium text-indigo-700">In-house guests leaving on future dates</p>
        </div>
      </motion.div>

      <motion.div variants={revealSoft} className="mb-6">
        <input
          type="text"
          placeholder="Search by booking ref, guest, email, phone, or room..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
        />
      </motion.div>

      <motion.div variants={revealSoft} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Guest</th>
              <th className="px-6 py-4 font-semibold">Booking</th>
              <th className="px-6 py-4 font-semibold">Stay Dates</th>
              <th className="px-6 py-4 font-semibold">Payment</th>
              <th className="px-6 py-4 font-semibold">Departure Window</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                  Loading check-out queue...
                </td>
              </tr>
            ) : checkOutQueue.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                  {searchQuery ? "No in-house guests match your search." : "No checked-in guests are waiting for check-out."}
                </td>
              </tr>
            ) : (
              checkOutQueue.map((booking, index) => {
                const departureState = getDepartureState(booking.checkOutDate);

                return (
                  <motion.tr
                    key={booking.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: index * 0.03 }}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{booking.name}</div>
                      <div className="text-slate-500">{booking.email}</div>
                      <div className="text-slate-500">{booking.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{booking.bookingRef}</div>
                      <div className="text-slate-500">{booking.roomId?.title || "Room"}</div>
                      <div className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 bg-slate-100">
                        {booking.guests} guest{booking.guests === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-900">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        In: {new Date(booking.checkInDate).toLocaleDateString()}
                      </div>
                      <div className="mt-1 text-slate-500">
                        Out: {new Date(booking.checkOutDate).toLocaleDateString()}
                      </div>
                      <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBookingStatusClasses(booking.bookingStatus)}`}>
                        {getBookingStatusLabel(booking.bookingStatus)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {getPaymentMethodLabel(booking.paymentMethod)}
                        </span>
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClasses(booking.paymentStatus)}`}>
                            {booking.paymentStatus}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-500">
                          Rs. {Number(booking.totalPrice || 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${departureState.classes}`}>
                        {departureState.label}
                      </span>
                      <div className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700">
                        {getBookingStatusLabel(booking.bookingStatus)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleCheckOut(booking)}
                        disabled={updatingId === booking.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {updatingId === booking.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                        Mark Checked Out
                      </button>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>

      <motion.div variants={revealSoft} className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-indigo-600" />
          <p>
            Marking a guest as checked out closes the stay with the stored `completed` status, which keeps reporting clean while freeing the room for future bookings.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

