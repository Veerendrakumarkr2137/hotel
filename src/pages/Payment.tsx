import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { API_URL } from "../lib/api";
import { createAuthHeaders, getUserToken } from "../lib/auth";
import {
  buildManualUpiConfirmationMessage,
  buildPaymentConfirmationEmailLink,
  buildWhatsAppLink,
} from "../lib/paymentContact";

type PaymentView = "idle" | "success" | "failed" | "pending" | "submitted";

type PaymentConfig = {
  phonePeEnabled: boolean;
  payAtHotelEnabled: boolean;
  upiId?: string;
  upiName?: string;
  supportEmail?: string;
  supportPhone?: string;
  whatsAppNumber?: string;
};

function getPaymentView(paymentStatus?: string): PaymentView {
  if (paymentStatus === "paid") {
    return "success";
  }

  if (paymentStatus === "submitted") {
    return "submitted";
  }

  if (paymentStatus === "failed") {
    return "failed";
  }

  return "pending";
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSubmittingManualPayment, setIsSubmittingManualPayment] = useState(false);
  const [paymentView, setPaymentView] = useState<PaymentView>("idle");
  const [error, setError] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    phonePeEnabled: false,
    payAtHotelEnabled: true,
  });
  const transactionIdFromUrl = searchParams.get("transactionId");

  const isManualUpi = booking?.paymentMethod === "manual_upi";
  const isPayAtHotel = booking?.paymentMethod === "pay_at_hotel";
  const activeTransactionId = useMemo(
    () => transactionIdFromUrl || booking?.transactionId || "",
    [booking?.transactionId, transactionIdFromUrl],
  );
  const supportEmail = booking?.supportEmail || paymentConfig.supportEmail || "";
  const supportPhone = booking?.supportPhone || paymentConfig.supportPhone || "";
  const whatsAppNumber = booking?.whatsAppNumber || paymentConfig.whatsAppNumber || "";
  const whatsAppLink = useMemo(
    () => (isManualUpi ? buildWhatsAppLink(whatsAppNumber, booking) : ""),
    [booking, isManualUpi, whatsAppNumber],
  );
  const emailLink = useMemo(
    () => (isManualUpi ? buildPaymentConfirmationEmailLink(supportEmail, booking) : ""),
    [booking, isManualUpi, supportEmail],
  );
  const loginRedirect = typeof window !== "undefined"
    ? `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
    : "/login";

  const syncPhonePeStatus = async (transactionId: string, showToast = false) => {
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
        const message = data.error || "Unable to verify PhonePe payment.";
        setPaymentView("pending");
        if (showToast) {
          toast.error(message);
        }
        return;
      }

      setBooking(data.booking);
      setPaymentView(getPaymentView(data.paymentStatus));

      if (showToast) {
        if (data.paymentStatus === "paid") {
          toast.success("Payment verified successfully.");
        } else if (data.paymentStatus === "failed") {
          toast.error("Payment failed. Please try again.");
        } else {
          toast.info("Payment is still pending.");
        }
      }
    } catch (fetchError) {
      const message = "Unable to verify PhonePe payment right now.";
      setPaymentView("pending");
      if (showToast) {
        toast.error(message);
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

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
          setError(data.error || "Failed to load booking.");
          return;
        }

        setBooking(data.booking);
        setPaymentView(getPaymentView(data.booking.paymentStatus));

        if (data.booking.paymentMethod === "PhonePe" && transactionIdFromUrl) {
          await syncPhonePeStatus(transactionIdFromUrl);
        }
      } catch (fetchError) {
        setError("Failed to load booking.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [id, navigate, transactionIdFromUrl]);

  const handleCopyUpi = () => {
    if (!booking?.upiId) {
      return;
    }

    navigator.clipboard
      .writeText(booking.upiId)
      .then(() => toast.success("UPI ID copied to clipboard"))
      .catch(() => toast.error("Failed to copy UPI ID"));
  };

  const handleCopyPaymentMessage = () => {
    navigator.clipboard
      .writeText(buildManualUpiConfirmationMessage(booking))
      .then(() => toast.success("Payment confirmation message copied"))
      .catch(() => toast.error("Failed to copy confirmation message"));
  };

  const handleRetryPhonePe = async () => {
    const token = getUserToken();

    if (!token) {
      navigate(loginRedirect, { replace: true });
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
        body: JSON.stringify({
          bookingId: booking.id,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.redirectUrl) {
        toast.error(data.error || "Unable to restart PhonePe payment.");
        return;
      }

      window.location.href = data.redirectUrl;
    } catch (fetchError) {
      toast.error("Unable to restart PhonePe payment.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSubmitManualPayment = async () => {
    const token = getUserToken();

    if (!token) {
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
      setPaymentView(getPaymentView(data.booking.paymentStatus));
      toast.success(data.message || "Payment submitted successfully.");
      navigate(`/booking-confirmation/${booking.id}`);
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
          <span className="text-slate-700">Loading payment details...</span>
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

  return (
    <div className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto max-w-3xl space-y-6 px-4">
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-3xl font-bold text-[#0B1B3D]">Payment</h1>

          <div className="space-y-4 text-gray-700">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Booking reference</p>
                  <p className="text-lg font-semibold text-slate-900">{booking.bookingRef}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total amount</p>
                  <p className="text-lg font-semibold text-slate-900">Rs. {booking.totalPrice}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Check-in</p>
                  <p className="text-base font-medium text-slate-800">
                    {new Date(booking.checkInDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Check-out</p>
                  <p className="text-base font-medium text-slate-800">
                    {new Date(booking.checkOutDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Guests</p>
                  <p className="text-base font-medium text-slate-800">{booking.guests}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Room</p>
                  <p className="text-base font-medium text-slate-800">{booking.roomId?.title || "--"}</p>
                </div>
              </div>

              {!isManualUpi && activeTransactionId && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction ID</p>
                  <p className="text-sm font-medium text-slate-900">{activeTransactionId}</p>
                </div>
              )}
            </div>

            {isManualUpi ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold text-slate-900">Pay via UPI</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Use the UPI ID below to send payment, then confirm it with the hotel on WhatsApp or email for quick verification.
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">UPI ID</p>
                      <p className="text-lg font-medium text-slate-900">{booking.upiId || "-"}</p>
                      {booking.upiName && <p className="mt-1 text-sm text-slate-500">{booking.upiName}</p>}
                    </div>
                    <button
                      onClick={handleCopyUpi}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Copy
                    </button>
                  </div>

                  {(whatsAppLink || emailLink) ? (
                    <>
                      <div
                        className={`rounded-lg px-4 py-3 text-sm ${
                          paymentView === "submitted"
                            ? "border border-sky-200 bg-sky-50 text-sky-800"
                            : "border border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {paymentView === "submitted"
                          ? "Your payment has been submitted for review. Hotel staff will verify it shortly."
                          : "After payment, send your booking reference and payment screenshot or UTR to the hotel for verification."}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {whatsAppLink && (
                          <a
                            href={whatsAppLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                          >
                            Confirm on WhatsApp
                          </a>
                        )}
                        {emailLink && (
                          <a
                            href={emailLink}
                            className="rounded-md bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            Confirm by Email
                          </a>
                        )}
                      </div>

                      {paymentView !== "submitted" && (
                        <button
                          onClick={handleSubmitManualPayment}
                          disabled={isSubmittingManualPayment}
                          className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
                        >
                          {isSubmittingManualPayment ? "Submitting..." : "Payment Submitted"}
                        </button>
                      )}

                      <button
                        onClick={handleCopyPaymentMessage}
                        className="rounded-md border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Copy Confirmation Message
                      </button>

                      {(supportPhone || supportEmail) && (
                        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          {supportPhone && <p>WhatsApp: {supportPhone}</p>}
                          {supportEmail && <p>Email: {supportEmail}</p>}
                        </div>
                      )}

                      {paymentView === "submitted" && (
                        <button
                          onClick={() => navigate("/my-bookings")}
                          className="rounded-md border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Back to My Bookings
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      After payment, share your booking reference with hotel staff so they can verify the transfer securely.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {isPayAtHotel ? "Pay now to save time" : "PhonePe payment"}
                </h2>

                {isCheckingStatus ? (
                  <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                    <p className="text-sm font-medium text-slate-700">Checking PhonePe payment status...</p>
                  </div>
                ) : paymentView === "success" ? (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-lg font-semibold text-emerald-700">Payment successful</p>
                    <p className="mt-2 text-sm text-emerald-700">
                      Your payment has been verified and your booking is confirmed.
                    </p>
                    <button
                      onClick={() => navigate("/my-bookings")}
                      className="mt-4 rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
                    >
                      View My Bookings
                    </button>
                  </div>
                ) : paymentView === "failed" ? (
                  <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
                    <p className="text-lg font-semibold text-red-700">Payment failed</p>
                    <p className="mt-2 text-sm text-red-700">
                      PhonePe did not confirm this payment. You can try again with the same booking.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {paymentConfig.phonePeEnabled ? (
                        <button
                          onClick={handleRetryPhonePe}
                          disabled={isRetrying}
                          className="rounded-md bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
                        >
                          {isRetrying ? "Redirecting..." : "Pay with PhonePe"}
                        </button>
                      ) : (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          PhonePe payments are unavailable right now.
                        </div>
                      )}
                      <button
                        onClick={() => navigate("/my-bookings")}
                        className="rounded-md border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View My Bookings
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <p className="text-lg font-semibold text-amber-700">
                      {isPayAtHotel ? "Booking confirmed, payment optional" : "Payment pending"}
                    </p>
                    <p className="mt-2 text-sm text-amber-700">
                      {isPayAtHotel
                        ? "Your room is already confirmed. If you pay now with PhonePe, check-in will be even faster when you arrive."
                        : "Complete the payment in PhonePe, then return here to verify the latest status."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {activeTransactionId && (
                        <button
                          onClick={() => syncPhonePeStatus(activeTransactionId, true)}
                          className="rounded-md bg-amber-500 px-5 py-3 font-semibold text-white hover:bg-amber-600"
                        >
                          Check Payment Status
                        </button>
                      )}
                      {paymentConfig.phonePeEnabled ? (
                        <button
                          onClick={handleRetryPhonePe}
                          disabled={isRetrying}
                          className="rounded-md bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
                        >
                          {isRetrying ? "Redirecting..." : isPayAtHotel ? "Pay now with PhonePe" : "Pay with PhonePe"}
                        </button>
                      ) : (
                        <div className="rounded-md border border-amber-200 bg-white px-4 py-3 text-sm text-amber-800">
                          Online PhonePe payments are unavailable right now.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

