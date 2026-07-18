import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from "react-toastify";
import { Trash2, Copy, CheckCircle2 } from "lucide-react";
import { API_URL } from "../lib/api";
import { motion } from "motion/react";
import { revealSoft, revealUp, sectionStagger } from "../lib/animations";
import {
  getBookingStatusLabel,
  getBookingStatusSelectClasses,
  getPaymentMethodLabel,
  getPaymentStatusClasses,
  sortBookingsByNewest,
} from "../lib/bookingUi";

export default function AdminBookings() {
  const { adminToken } = useContext(AuthContext);
  const [bookings, setBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    if (adminToken) {
      fetchBookings();
    }
  }, [adminToken]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBookings(bookings);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = bookings.filter((booking) =>
        booking.bookingRef.toLowerCase().includes(query) ||
        booking.name.toLowerCase().includes(query) ||
        booking.email.toLowerCase().includes(query) ||
        booking.phone.includes(query)
      );
      setFilteredBookings(filtered);
    }
  }, [searchQuery, bookings]);

  const fetchBookings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/bookings/admin/all`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (data.success) {
        setBookings(sortBookingsByNewest(data.bookings));
      }
    } catch (err) {
      toast.error("Failed to load bookings");
    }
  };

  const copyBookingRef = async (bookingRef: string) => {
    try {
      await navigator.clipboard.writeText(bookingRef);
      toast.success("Booking reference copied");
    } catch {
      toast.error("Unable to copy booking reference");
    }
  };

  const deleteBooking = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await axios.delete(`${API_URL}/api/bookings/admin/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      toast.success("Booking deleted");
      fetchBookings();
    } catch (err) {
      toast.error("Failed to delete booking");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await axios.put(
        `${API_URL}/api/bookings/admin/${id}/status`,
        { status },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      toast.success(`Booking ${status}`);
      fetchBookings();
    } catch (err) {
      toast.error("Status update failed");
    }
  };

  const verifyManualPayment = async (id: string) => {
    setVerifyingId(id);

    try {
      const { data } = await axios.put(
        `${API_URL}/api/bookings/admin/${id}/verify-manual-payment`,
        {},
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      if (data.success) {
        toast.success("Manual UPI payment verified");
        fetchBookings();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to verify manual payment");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={sectionStagger} className="max-w-7xl mx-auto">
      <motion.h1 variants={revealUp} className="mb-8 text-3xl font-bold text-slate-900">
        Manage Bookings
      </motion.h1>

      <motion.div variants={revealSoft} className="mb-6 grid gap-4 md:grid-cols-2">
        <Link
          to="/admin/check-in"
          className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-100"
        >
          Open Check-In Desk
        </Link>
        <Link
          to="/admin/check-out"
          className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
        >
          Open Check-Out Desk
        </Link>
      </motion.div>

      <motion.div variants={revealSoft} className="mb-6">
        <input
          type="text"
          placeholder="Search by booking ID, name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
        />
        {searchQuery && (
          <p className="mt-2 text-sm text-slate-500">Found {filteredBookings.length} booking(s)</p>
        )}
      </motion.div>

      <motion.div
        variants={revealSoft}
        className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
      >
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Ref / Room</th>
              <th className="px-6 py-4 font-semibold">Guest Name</th>
              <th className="px-6 py-4 font-semibold">Dates</th>
              <th className="px-6 py-4 font-semibold">Payment</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredBookings.map((booking, index) => (
              <motion.tr
                key={booking.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.03 }}
                className="transition-colors hover:bg-slate-50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    {booking.bookingRef}
                    <button
                      onClick={() => copyBookingRef(booking.bookingRef)}
                      className="text-slate-400 transition-colors hover:text-slate-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="font-medium text-slate-500">{booking.roomId?.title || "Unknown Room"}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{booking.name}</div>
                  <div className="text-slate-500">{booking.email}</div>
                  <div className="text-slate-500">{booking.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-900">In: {new Date(booking.checkInDate).toLocaleDateString()}</div>
                  <div className="text-slate-500">Out: {new Date(booking.checkOutDate).toLocaleDateString()}</div>
                  <div className="mt-1 font-medium text-slate-600">{booking.guests} Guests</div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {getPaymentMethodLabel(booking.paymentMethod)}
                    </span>
                    <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusClasses(booking.paymentStatus)}`}
                    >
                      {booking.paymentStatus}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      Rs. {Number(booking.totalPrice || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <motion.div whileHover={{ y: -1 }}>
                    <select
                      value={booking.bookingStatus}
                      onChange={(e) => updateStatus(booking.id, e.target.value)}
                      className={`block w-full cursor-pointer rounded-lg border border-transparent p-2 px-3 text-sm font-semibold outline-none focus:border-slate-900 focus:ring-slate-900 ${getBookingStatusSelectClasses(booking.bookingStatus)}`}
                    >
                      <option value="pending" className="text-slate-900">
                        Pending
                      </option>
                      <option value="pending_payment" className="text-slate-900">
                        Pending Payment
                      </option>
                      <option value="confirmed" className="text-slate-900">
                        Confirmed
                      </option>
                      <option value="checked_in" className="text-slate-900">
                        Checked In
                      </option>
                      <option value="cancelled" className="text-slate-900">
                        Cancelled
                      </option>
                      <option value="completed" className="text-slate-900">
                        Checked Out
                      </option>
                    </select>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Current: {getBookingStatusLabel(booking.bookingStatus)}
                    </p>
                  </motion.div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    {booking.paymentMethod === "manual_upi" &&
                      booking.paymentStatus !== "paid" &&
                      booking.bookingStatus !== "cancelled" &&
                      booking.bookingStatus !== "completed" && (
                        <motion.button
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => verifyManualPayment(booking.id)}
                          disabled={verifyingId === booking.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-70"
                        >
                          {verifyingId === booking.id ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Verify UPI
                        </motion.button>
                      )}
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => deleteBooking(booking.id)}
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

        {filteredBookings.length === 0 && (
          <motion.div variants={revealSoft} className="py-12 text-center text-lg text-slate-500">
            {searchQuery ? "No bookings match your search." : "No bookings found."}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

