import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, Home, XCircle } from "lucide-react";
import { API_URL } from "../lib/api";
import { createAuthHeaders, getUserToken } from "../lib/auth";
import { getBookingStatusClasses, getBookingStatusLabel } from "../lib/bookingUi";
import { buildPaymentConfirmationEmailLink, buildWhatsAppLink } from "../lib/paymentContact";

type ConfirmationState = "loading" | "success" | "failed" | "pending" | "submitted";

type PaymentConfig = {
  phonePeEnabled: boolean;
  payAtHotelEnabled: boolean;
  supportEmail?: string;
  supportPhone?: string;
  whatsAppNumber?: string;
};

function getConfirmationState(booking: any, transactionId: string): ConfirmationState {
  if (!booking) {
    return "loading";
  }

  if (booking.paymentMethod === "pay_at_hotel" || booking.paymentStatus === "paid") {
    return "success";
  }

  if (booking.paymentMethod === "manual_upi" && booking.paymentStatus === "submitted") {
    return "submitted";
  }

  if (booking.paymentMethod === "PhonePe" && transactionId) {
    if (booking.paymentStatus === "failed") {
      return "failed";
    }

    if (booking.paymentStatus === "pending") {
      return "pending";
    }
  }

  return "pending";
}

export default function BookingConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionIdFromUrl = searchParams.get("transactionId") || "";
  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSubmittingManualPayment, setIsSubmittingManualPayment] = useState(false);
  const [error, setError] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    phonePeEnabled: false,
    payAtHotelEnabled: true,
  });
  const loginRedirect = typeof window !== "undefined"
    ? `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
    : "/login";
  const confirmationState = useMemo(
    () => getConfirmationState(booking, transactionIdFromUrl || booking?.transactionId || ""),
    [booking, transactionIdFromUrl],
  );
  const supportEmail = booking?.supportEmail || paymentConfig.supportEmail || "";
  const supportPhone = booking?.supportPhone || paymentConfig.supportPhone || "";
  const whatsAppNumber = booking?.whatsAppNumber || paymentConfig.whatsAppNumber || "";
  const whatsAppLink = useMemo(
    () => (booking?.paymentMethod === "manual_upi" ? buildWhatsAppLink(whatsAppNumber, booking) : ""),
    [booking, whatsAppNumber],
  );
  const emailLink = useMemo(
    () => (booking?.paymentMethod === "manual_upi" ? buildPaymentConfirmationEmailLink(supportEmail, booking) : ""),
    [booking, supportEmail],
  );

  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payment/config`);
        const data = await response.json();

        if (response.ok && data.success) {
          setPaymentConfig(data.payment);
        }
      } catch {
        // Keep safe defaults if config is unavailable.
      }
    };

    fetchPaymentConfig();
  }, []);

  const verifyPhonePeStatus = async (transactionId: string, showToast = false) => {
    const token = getUserToken();

    if (!token) {
      navigate(loginRedirect, { replace: true });
      return;
    }

    setIsCheckingStatus(true);

    try {
      const response = await fetch(`${API_URL}/api/payment/status/${transactionId}`, {
        headers: createAuthHeaders(token),
      });

      if (response.status === 401 || response.status === 403) {
        navigate(loginRedirect, { replace: true });
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (showToast) {
          toast.error(data.error || "Unable to verify payment status.");
        }
        return;
      }

      setBooking(data.booking);

      if (showToast) {
        if (data.paymentStatus === "paid") {
          toast.success("Payment verified successfully.");
        } else if (data.paymentStatus === "failed") {
          toast.error("Payment failed. Please try again.");
        } else {
          toast.info("Payment is still pending.");
        }
      }
    } catch {
      if (showToast) {
        toast.error("Unable to verify payment status right now.");
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    const token = getUserToken();

    if (!token) {
      navigate(loginRedirect, { replace: true });
      return;
    }

    const fetchBooking = async () => {
      try {
        const response = await fetch(`${API_URL}/api/bookings/${id}`, {
          headers: createAuthHeaders(token),
        });

        if (response.status === 401 || response.status === 403) {
          navigate(loginRedirect, { replace: true });
          return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || "Failed to load booking confirmation.");
          return;
        }

        setBooking(data.booking);

        if (data.booking.paymentMethod === "PhonePe" && transactionIdFromUrl) {
          await verifyPhonePeStatus(transactionIdFromUrl);
        }
      } catch {
        setError("Failed to load booking confirmation.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [id, navigate, transactionIdFromUrl]);

  const handleRetryPhonePe = async () => {
    const token = getUserToken();

    if (!token) {
      navigate(loginRedirect, { replace: true });
      return;
    }

    if (!booking?.id) {
      return;
    }

    setIsRetrying(true);

    try {
      const response = await fetch(`${API_URL}/api/payment/phonepe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createAuthHeaders(token),
        },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.redirectUrl) {
        toast.error(data.error || "Unable to restart PhonePe payment.");
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      toast.error("Unable to restart PhonePe payment.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSubmitManualPayment = async () => {
    const token = getUserToken();

    if (!token || !booking?.id) {
      navigate(loginRedirect, { replace: true });
      return;
    }

    setIsSubmittingManualPayment(true);

    try {
      const response = await fetch(`${API_URL}/api/bookings/${booking.id}/confirm-payment`, {
        method: "POST",
        headers: createAuthHeaders(token),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        if (!response.ok) {
          toast.error(data.error || "Please sign in again.");
        }
        navigate(loginRedirect, { replace: true });
        return;
      }

      if (!response.ok || !data.success) {
        toast.error(data.error || "Unable to submit payment right now.");
        return;
      }

      setBooking(data.booking);
      toast.success(data.message || "Payment submitted successfully.");
    } catch {
      toast.error("Unable to submit payment right now.");
    } finally {
      setIsSubmittingManualPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-white px-6 py-4 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <span className="text-slate-700">Loading booking confirmation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-20 text-center text-red-600">{error}</div>;
  }

  if (!booking) {
    return <div className="p-20 text-center text-red-600">Booking not found.</div>;
  }

  const transactionId = transactionIdFromUrl || booking.transactionId || "";
  const paymentMethodLabel = booking.paymentMethod === "pay_at_hotel" ? "Pay at Hotel" : booking.paymentMethod;
  const paymentStatusLabel = booking.paymentMethod === "pay_at_hotel" ? "Pay on arrival" : booking.paymentStatus;
  const confirmationBadge = confirmationState === "success"
    ? "Confirmed"
    : confirmationState === "submitted"
      ? "Submitted"
    : confirmationState === "failed"
      ? "Failed"
      : "Pending";

  return (
    <div className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] px-8 py-10 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Booking Confirmation</p>
                <h1 className="mt-3 text-3xl font-bold">Your stay details are ready</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300">
                  Review your booking summary, payment result, and the next step for your reservation.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                  {confirmationState === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  ) : confirmationState === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-300" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-amber-300" />
                  )}
                  {confirmationBadge}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Booking Ref</p>
                <p className="mt-2 text-lg font-semibold">{booking.bookingRef}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                {confirmationState === "success" ? (
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="mt-0.5 h-8 w-8 text-emerald-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        {booking.paymentMethod === "pay_at_hotel" ? "Room booking confirmed" : "Payment successful"}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {booking.paymentMethod === "pay_at_hotel"
                          ? "Your reservation is confirmed. You can pay at the hotel during check-in."
                          : "Your payment has been verified and your booking is confirmed."}
                      </p>
                    </div>
                  </div>
                ) : confirmationState === "submitted" ? (
                  <div className="flex items-start gap-4">
                    <Clock3 className="mt-0.5 h-8 w-8 text-sky-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Payment submitted for review</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Your manual UPI payment has been submitted. Hotel staff will verify it and confirm the booking soon.
                      </p>
                    </div>
                  </div>
                ) : confirmationState === "failed" ? (
                  <div className="flex items-start gap-4">
                    <XCircle className="mt-0.5 h-8 w-8 text-red-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Payment failed</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        PhonePe did not confirm this payment. You can retry the payment with the same booking details.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <Clock3 className="mt-0.5 h-8 w-8 text-amber-500" />
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Payment pending</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        We are still waiting for the final payment update. You can check the latest status anytime.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-bold text-slate-900">Guest and stay details</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Guest</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{booking.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{booking.email}</p>
                    <p className="mt-1 text-sm text-slate-600">{booking.phone}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Room</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{booking.roomId?.title || "Room"}</p>
                    <p className="mt-1 text-sm text-slate-600">{booking.guests} guest(s)</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check-in</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {new Date(booking.checkInDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check-out</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {new Date(booking.checkOutDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-lg font-bold text-slate-900">Payment summary</h3>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-semibold text-slate-900">Rs. {booking.totalPrice?.toLocaleString?.("en-IN") || booking.totalPrice}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Method</span>
                    <span className="font-semibold text-slate-900">{paymentMethodLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Payment status</span>
                    <span className={`font-semibold ${
                      confirmationState === "success"
                        ? "text-emerald-700"
                        : confirmationState === "submitted"
                          ? "text-sky-700"
                          : confirmationState === "failed"
                            ? "text-red-700"
                            : "text-amber-700"
                    }`}>
                      {paymentStatusLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Booking status</span>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getBookingStatusClasses(booking.bookingStatus)}`}>
                      {(booking.bookingStatus === "confirmed" || booking.bookingStatus === "checked_in") && <CheckCircle2 className="h-4 w-4" />}
                      {getBookingStatusLabel(booking.bookingStatus)}
                    </span>
                  </div>
                  {transactionId && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction ID</p>
                      <p className="mt-2 break-all text-sm font-medium text-slate-900">{transactionId}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-bold text-slate-900">Next actions</h3>
                <div className="mt-5 grid gap-3">
                  {confirmationState === "pending" && transactionId && (
                    <button
                      onClick={() => verifyPhonePeStatus(transactionId, true)}
                      disabled={isCheckingStatus}
                      className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white hover:bg-amber-600 disabled:opacity-70"
                    >
                      {isCheckingStatus ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                      Check payment status
                    </button>
                  )}

                  {booking.paymentMethod === "PhonePe" && confirmationState !== "success" && paymentConfig.phonePeEnabled && (
                    <button
                      onClick={handleRetryPhonePe}
                      disabled={isRetrying}
                      className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
                    >
                      {isRetrying ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      {isRetrying ? "Redirecting to PhonePe" : "Retry PhonePe payment"}
                    </button>
                  )}

                  {booking.paymentMethod === "pay_at_hotel" && booking.paymentStatus !== "paid" && paymentConfig.phonePeEnabled && (
                    <button
                      onClick={() => navigate(`/payment/${booking.id}`)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
                    >
                      <CreditCard className="h-4 w-4" />
                      Pay now to save time
                    </button>
                  )}

                  {booking.paymentMethod === "manual_upi" && (
                    <>
                      <div
                        className={`rounded-xl px-4 py-3 text-sm ${
                          confirmationState === "submitted"
                            ? "border border-sky-200 bg-sky-50 text-sky-800"
                            : "border border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {confirmationState === "submitted"
                          ? "Your payment has been submitted for review. You can return to your bookings while the hotel verifies it."
                          : "Manual UPI payments are verified by hotel staff. Send your booking reference and payment proof on WhatsApp or email after payment."}
                      </div>

                      {whatsAppLink && (
                        <a
                          href={whatsAppLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
                        >
                          Confirm on WhatsApp
                        </a>
                      )}

                      {emailLink && (
                        <a
                          href={emailLink}
                          className="flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
                        >
                          Confirm by Email
                        </a>
                      )}

                      {confirmationState !== "submitted" && (
                        <button
                          onClick={handleSubmitManualPayment}
                          disabled={isSubmittingManualPayment}
                          className="flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
                        >
                          {isSubmittingManualPayment ? "Submitting..." : "Payment Submitted"}
                        </button>
                      )}

                      {(supportPhone || supportEmail) && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          {supportPhone && <p>WhatsApp: {supportPhone}</p>}
                          {supportEmail && <p>Email: {supportEmail}</p>}
                        </div>
                      )}
                    </>
                  )}

                  {!paymentConfig.phonePeEnabled && booking.paymentMethod !== "manual_upi" && confirmationState !== "success" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Online PhonePe payments are unavailable right now.
                    </div>
                  )}

                  <Link
                    to="/my-bookings"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <CalendarDays className="h-4 w-4" />
                    View my bookings
                  </Link>

                  <Link
                    to="/rooms"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Home className="h-4 w-4" />
                    Explore more rooms
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

