import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import { API_URL } from "../lib/api";

type PaymentMethod = "phonepe" | "manual_upi" | "pay_at_hotel";

type PaymentConfig = {
  phonePeEnabled: boolean;
  manualUpiEnabled: boolean;
  payAtHotelEnabled: boolean;
  upiId?: string;
  upiName?: string;
};

function getDefaultPaymentMethod(config: PaymentConfig): PaymentMethod {
  if (config.phonePeEnabled) {
    return "phonepe";
  }

  if (config.manualUpiEnabled) {
    return "manual_upi";
  }

  return "pay_at_hotel";
}

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, userToken } = useContext(AuthContext);
  const [room, setRoom] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pay_at_hotel");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    phonePeEnabled: false,
    manualUpiEnabled: false,
    payAtHotelEnabled: true,
  });
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    checkInDate: "",
    checkOutDate: "",
    guests: 1,
  });

  useEffect(() => {
    if (!userToken) {
      toast.error("Please login to book a room");
      navigate("/login");
      return;
    }

    const fetchRoom = async () => {
      try {
        const [roomResponse, paymentConfigResponse] = await Promise.allSettled([
          axios.get(`${API_URL}/api/rooms/${id}`),
          axios.get(`${API_URL}/api/payment/config`),
        ]);

        if (roomResponse.status === "fulfilled" && roomResponse.value.data.success) {
          setRoom(roomResponse.value.data.room);
        } else {
          throw new Error("Room request failed");
        }

        if (paymentConfigResponse.status === "fulfilled" && paymentConfigResponse.value.data.success) {
          const nextConfig = paymentConfigResponse.value.data.payment as PaymentConfig;
          setPaymentConfig(nextConfig);
          setPaymentMethod(getDefaultPaymentMethod(nextConfig));
        }
      } catch (error) {
        toast.error("Failed to fetch room details");
      }
    };

    fetchRoom();
  }, [id, navigate, userToken]);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      name: user?.name || current.name,
      email: user?.email || current.email,
    }));
  }, [user]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: name === "guests" ? Number(value) : value,
    }));
  };

  const calculateTotal = () => {
    if (!room || !formData.checkInDate || !formData.checkOutDate) {
      return 0;
    }

    const start = new Date(formData.checkInDate);
    const end = new Date(formData.checkOutDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays * room.price : room.price;
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.checkInDate || !formData.checkOutDate) {
      toast.error("Please fill all details");
      return;
    }

    if (!room) {
      toast.error("Room details are not available");
      return;
    }

    const totalAmount = calculateTotal();

    if (!totalAmount) {
      toast.error("Please select valid booking dates");
      return;
    }

    if (paymentMethod === "phonepe" && !paymentConfig.phonePeEnabled) {
      toast.error("PhonePe UPI payments are currently unavailable. Please choose another option.");
      return;
    }

    if (paymentMethod === "manual_upi" && !paymentConfig.manualUpiEnabled) {
      toast.error("Direct UPI payments are currently unavailable. Please choose another option.");
      return;
    }

    setIsSubmitting(true);

    try {
      const bookingData = {
        roomId: room.id,
        ...formData,
        totalPrice: totalAmount,
      };

      if (paymentMethod === "pay_at_hotel") {
        const { data } = await axios.post(
          `${API_URL}/api/bookings/pay-at-hotel`,
          { bookingData },
          { headers: { Authorization: `Bearer ${userToken}` } },
        );

        if (data.success) {
          toast.success("Booking confirmed! Please pay at the hotel upon arrival.");
          navigate(`/booking-confirmation/${data.booking.id}`);
        }

        return;
      }

      if (paymentMethod === "manual_upi") {
        const { data } = await axios.post(
          `${API_URL}/api/bookings/manual-booking`,
          { bookingData },
          { headers: { Authorization: `Bearer ${userToken}` } },
        );

        if (data.success) {
          toast.success("Booking created. Complete the hotel UPI payment to finish confirmation.");
          navigate(`/payment/${data.booking.id}`);
        }

        return;
      }

      const { data } = await axios.post(
        `${API_URL}/api/payment/phonepe`,
        { bookingData },
        { headers: { Authorization: `Bearer ${userToken}` } },
      );

      if (!data.success || !data.redirectUrl) {
        throw new Error(data.error || "Unable to start PhonePe payment");
      }

      window.location.href = data.redirectUrl;
    } catch (error: any) {
      const bookingId = error?.response?.data?.bookingId;
      const errorMessage = error?.response?.data?.error || error?.message || "Payment failed";

      toast.error(errorMessage);

      if (bookingId) {
        navigate(`/payment/${bookingId}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!room) {
    return <div className="py-20 text-center text-xl">Loading booking details...</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold text-slate-900">Complete Your Booking</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-8 text-slate-800 shadow-sm">
          <h2 className="mb-6 border-b border-slate-100 pb-4 text-2xl font-bold">Room Summary</h2>
          <img
            src={room.images?.[0] || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80"}
            alt={room.title}
            className="mb-6 h-48 w-full rounded-xl object-cover shadow-sm"
          />
          <h3 className="mb-2 text-xl font-semibold">{room.title}</h3>
          <p className="mb-6 text-sm text-slate-500">{room.description}</p>

          <div className="mt-auto border-t border-slate-100 pt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-500">Price per night</span>
              <span className="font-semibold">Rs. {room.price.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between text-xl font-bold text-slate-900">
              <span>Total Estimated</span>
              <span className="text-emerald-600">Rs. {calculateTotal().toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handlePayment} className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-slate-800">Guest Details</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-200 p-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                readOnly
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-200 p-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Check-in</label>
                <input
                  type="date"
                  name="checkInDate"
                  value={formData.checkInDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-200 p-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Check-out</label>
                <input
                  type="date"
                  name="checkOutDate"
                  value={formData.checkOutDate}
                  min={formData.checkInDate || new Date().toISOString().split("T")[0]}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-200 p-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Guests</label>
              <select
                name="guests"
                value={formData.guests}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 p-3 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900"
              >
                {[...Array(room.capacity)].map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1} {index === 0 ? "Guest" : "Guests"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <label className="mb-4 block text-sm font-semibold text-slate-900">Payment Method</label>
            <div className="grid gap-3">
              {paymentConfig.phonePeEnabled ? (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    paymentMethod === "phonepe"
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="phonepe"
                    checked={paymentMethod === "phonepe"}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    className="mt-1 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">PhonePe UPI</p>
                    <p className="text-sm text-slate-500">Pay instantly using PhonePe and supported UPI apps.</p>
                  </div>
                </label>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {paymentConfig.manualUpiEnabled
                    ? "PhonePe UPI is unavailable right now. You can still continue with direct hotel UPI or pay at hotel."
                    : "PhonePe UPI is unavailable right now. You can still complete your booking with Pay at Hotel."}
                </div>
              )}
              {paymentConfig.manualUpiEnabled && (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    paymentMethod === "manual_upi"
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="manual_upi"
                    checked={paymentMethod === "manual_upi"}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    className="mt-1 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">Direct Hotel UPI</p>
                    <p className="text-sm text-slate-500">
                      Transfer to the hotel UPI ID, then confirm the payment on WhatsApp or email for verification.
                    </p>
                    {paymentConfig.upiId && (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        UPI ID: <span className="normal-case text-slate-700">{paymentConfig.upiId}</span>
                      </p>
                    )}
                    {paymentConfig.upiName && (
                      <p className="mt-1 text-xs text-slate-500">Receiver: {paymentConfig.upiName}</p>
                    )}
                  </div>
                </label>
              )}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  paymentMethod === "pay_at_hotel"
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="pay_at_hotel"
                  checked={paymentMethod === "pay_at_hotel"}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="mt-1 h-4 w-4 cursor-pointer"
                />
                <div>
                  <p className="font-semibold text-slate-900">Pay at Hotel</p>
                  <p className="text-sm text-slate-500">Reserve now and settle your bill during check-in.</p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-8 flex w-full items-center justify-center rounded-xl bg-slate-900 p-4 font-semibold text-white shadow-lg shadow-slate-900/10 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex items-center gap-3">
              {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {paymentMethod === "phonepe"
                ? isSubmitting
                  ? "Connecting to PhonePe"
                  : "Pay with PhonePe UPI"
                : paymentMethod === "manual_upi"
                  ? isSubmitting
                    ? "Preparing UPI Instructions"
                    : "Continue to Direct UPI Payment"
                : isSubmitting
                  ? "Confirming Booking"
                  : "Confirm Pay at Hotel Booking"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

