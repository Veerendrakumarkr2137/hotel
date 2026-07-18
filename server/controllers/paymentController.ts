import axios from "axios";
import crypto from "crypto";
import { Response } from "express";
import { supabase } from "../lib/supabaseClient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  BookingValidationError,
  ensureRoomAvailability,
  validateBookingInput,
} from "../lib/bookingValidation";
import { getFrontendUrl, getHotelContactDetails, getHotelUpiDetails } from "../lib/runtimeConfig";
import { adaptBooking } from "../lib/adapters";

const PHONEPE_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PHONEPE_PAY_PATH = "/pg/v1/pay";

type PaymentBookingData = {
  roomId: string;
  name: string;
  email: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice?: number;
};

type PhonePeConfig = {
  merchantId: string;
  saltKey: string;
  saltIndex: string;
};

function getMissingPhonePeConfigKeys() {
  const requiredKeys = ["MERCHANT_ID", "SALT_KEY", "SALT_INDEX"] as const;

  return requiredKeys.filter((key) => !process.env[key]?.trim());
}

function getPhonePeConfig(): PhonePeConfig | null {
  const merchantId = process.env.MERCHANT_ID?.trim();
  const saltKey = process.env.SALT_KEY?.trim();
  const saltIndex = process.env.SALT_INDEX?.trim();

  if (!merchantId || !saltKey || !saltIndex) {
    return null;
  }

  return {
    merchantId,
    saltKey,
    saltIndex,
  };
}

function buildChecksum(value: string, saltKey: string, saltIndex: string) {
  const checksum = crypto.createHash("sha256").update(value + saltKey).digest("hex");
  return `${checksum}###${saltIndex}`;
}

function getServerBaseUrl(request: AuthenticatedRequest) {
  const forwardedProtoHeader = request.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const protocol = forwardedProto?.split(",")[0]?.trim() || request.protocol || "http";
  const host = request.get("host");
  return host ? `${protocol}://${host}` : getFrontendUrl();
}

function getPhonePeStatusPath(merchantId: string, transactionId: string) {
  return `/pg/v1/status/${encodeURIComponent(merchantId)}/${encodeURIComponent(transactionId)}`;
}

function isValidBookingData(bookingData?: Partial<PaymentBookingData>): bookingData is PaymentBookingData {
  if (!bookingData) {
    return false;
  }

  return Boolean(
    bookingData.roomId &&
      bookingData.name &&
      bookingData.email &&
      bookingData.phone &&
      bookingData.checkInDate &&
      bookingData.checkOutDate &&
      Number(bookingData.guests) > 0,
  );
}

function getRedirectUrl(paymentResponse: any) {
  return (
    paymentResponse?.data?.instrumentResponse?.redirectInfo?.url ||
    paymentResponse?.data?.instrumentResponse?.intentUrl ||
    paymentResponse?.data?.redirectInfo?.url ||
    paymentResponse?.data?.intentUrl ||
    ""
  );
}

// Map the gateway transaction ID from the status payload
function getGatewayTransactionId(statusResponse: any) {
  return (
    statusResponse?.data?.transactionId ||
    statusResponse?.data?.paymentInstrument?.transactionId ||
    statusResponse?.paymentDetails?.[0]?.transactionId ||
    statusResponse?.transactionId ||
    ""
  );
}

function evaluateStatus(statusResponse: any, expectedAmount: number, expectedTransactionId: string) {
  const responseData = statusResponse?.data || statusResponse || {};
  const rawState = String(
    responseData?.state ||
      responseData?.responseCode ||
      statusResponse?.code ||
      statusResponse?.state ||
      "",
  ).toUpperCase();
  const rawCode = String(
    statusResponse?.code ||
      responseData?.responseCode ||
      responseData?.state ||
      "",
  ).toUpperCase();
  const amount = Number(responseData?.amount ?? statusResponse?.amount ?? 0);
  const responseTransactionId = String(
    responseData?.merchantTransactionId ||
      responseData?.transactionId ||
      statusResponse?.merchantTransactionId ||
      "",
  ).trim();
  const isAmountValid = amount > 0 ? amount === expectedAmount : true;
  const isTransactionValid = responseTransactionId ? responseTransactionId === expectedTransactionId : true;
  const successStates = new Set(["COMPLETED", "PAYMENT_SUCCESS", "SUCCESS"]);
  const failureStates = new Set(["FAILED", "FAILURE", "PAYMENT_ERROR", "BAD_REQUEST", "DECLINED", "EXPIRED", "CANCELLED"]);

  if (!isAmountValid || !isTransactionValid) {
    return "failed" as const;
  }

  const isSuccess =
    statusResponse?.success === true &&
    (successStates.has(rawState) || successStates.has(rawCode) || rawCode === "SUCCESS");
  const isFailure =
    statusResponse?.success === false ||
    failureStates.has(rawState) ||
    failureStates.has(rawCode);

  if (isSuccess) {
    return "paid" as const;
  }

  if (isFailure) {
    return "failed" as const;
  }

  return "pending" as const;
}

async function prepareBookingForPayment(
  request: AuthenticatedRequest,
  transactionId: string,
  bookingData?: PaymentBookingData,
  bookingId?: string,
) {
  const userId = request.auth?.userId;

  if (!userId) {
    return { error: "Authentication required", status: 401 as const };
  }

  if (bookingId) {
    const { data: existingBooking, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .eq("id", bookingId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !existingBooking) {
      return { error: "Booking not found", status: 404 as const };
    }

    if (["cancelled", "completed"].includes(existingBooking.booking_status)) {
      return { error: "This booking can no longer be paid online", status: 400 as const };
    }

    if (existingBooking.payment_status === "paid") {
      return { error: "This booking is already paid", status: 400 as const };
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        transaction_id: transactionId,
        order_id: transactionId,
        payment_id: null,
        signature: null,
        payment_status: "pending",
        booking_status: "pending_payment",
        payment_method: "PhonePe",
      })
      .eq("id", existingBooking.id)
      .select("*, roomId:rooms(*)")
      .single();

    if (updateError || !updatedBooking) {
      return { error: "Failed to update transaction state on booking", status: 500 as const };
    }

    return { booking: updatedBooking };
  }

  if (!isValidBookingData(bookingData)) {
    return { error: "Invalid booking details", status: 400 as const };
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", bookingData.roomId)
    .maybeSingle();

  if (roomError || !room) {
    return { error: "Room not found", status: 404 as const };
  }

  const validatedBooking = await validateBookingInput(room, bookingData);
  await ensureRoomAvailability(
    room.id,
    validatedBooking.checkInDate,
    validatedBooking.checkOutDate,
    room.available_rooms,
  );

  const bookingRef = `AIH-${Date.now()}`;
  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      booking_ref: bookingRef,
      user_id: userId,
      room_id: bookingData.roomId,
      name: validatedBooking.name,
      email: validatedBooking.email,
      phone: validatedBooking.phone,
      check_in_date: validatedBooking.checkInDate.toISOString(),
      check_out_date: validatedBooking.checkOutDate.toISOString(),
      guests: validatedBooking.guests,
      total_price: validatedBooking.totalPrice,
      payment_status: "pending",
      booking_status: "pending_payment",
      payment_method: "PhonePe",
      transaction_id: transactionId,
      order_id: transactionId,
    })
    .select()
    .single();

  if (insertError || !booking) {
    return { error: insertError?.message || "Failed to create booking", status: 500 as const };
  }

  const { data: populatedBooking } = await supabase
    .from("bookings")
    .select("*, roomId:rooms(*)")
    .eq("id", booking.id)
    .maybeSingle();

  return { booking: populatedBooking || booking };
}

async function fetchPhonePeStatus(transactionId: string, config: PhonePeConfig) {
  const statusPath = getPhonePeStatusPath(config.merchantId, transactionId);
  const checksum = buildChecksum(statusPath, config.saltKey, config.saltIndex);
  const url = `${PHONEPE_BASE_URL}${statusPath}`;
  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": config.merchantId,
    },
  });

  return response.data;
}

async function syncPhonePeBooking(transactionId: string) {
  const config = getPhonePeConfig();

  if (!config) {
    throw new Error(`PhonePe configuration is missing: ${getMissingPhonePeConfigKeys().join(", ")}`);
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*, roomId:rooms(*)")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error || !booking) {
    throw new Error("Booking not found");
  }

  const statusResponse = await fetchPhonePeStatus(transactionId, config);
  const paymentStatus = evaluateStatus(statusResponse, Math.round(Number(booking.total_price) * 100), transactionId);

  const updates: Record<string, any> = {
    payment_method: "PhonePe",
  };

  if (paymentStatus === "paid") {
    updates.payment_status = "paid";
    updates.booking_status = "confirmed";
    updates.payment_id = getGatewayTransactionId(statusResponse) || booking.payment_id;
  } else if (paymentStatus === "failed") {
    updates.payment_status = "failed";
    updates.booking_status = "pending_payment";
  } else {
    updates.payment_status = "pending";
    updates.booking_status = "pending_payment";
  }

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", booking.id)
    .select("*, roomId:rooms(*)")
    .single();

  if (updateError || !updatedBooking) {
    throw updateError || new Error("Failed to update payment status");
  }

  return {
    booking: updatedBooking,
    statusResponse,
    paymentStatus,
  };
}

export async function createPhonePePayment(request: AuthenticatedRequest, response: Response): Promise<any> {
  let activeBooking: any = null;

  try {
    const config = getPhonePeConfig();

    if (!config) {
      return response.status(500).json({
        success: false,
        error: `PhonePe configuration is missing: ${getMissingPhonePeConfigKeys().join(", ")}`,
      });
    }

    const { bookingData, bookingId } = request.body as {
      bookingData?: PaymentBookingData;
      bookingId?: string;
    };
    const transactionId = `TXN${Date.now()}`;
    const preparedBooking = await prepareBookingForPayment(request, transactionId, bookingData, bookingId);

    if ("error" in preparedBooking) {
      return response.status(preparedBooking.status).json({ success: false, error: preparedBooking.error });
    }

    activeBooking = preparedBooking.booking;
    const serverBaseUrl = getServerBaseUrl(request);
    const redirectUrl = `${getFrontendUrl()}/booking-confirmation/${activeBooking.id}?transactionId=${transactionId}`;
    const callbackUrl = `${serverBaseUrl}/api/payment/phonepe/callback/${transactionId}`;
    const payload = {
      merchantId: config.merchantId,
      merchantTransactionId: transactionId,
      merchantUserId: request.auth?.userId,
      amount: Math.round(Number(activeBooking.total_price) * 100),
      redirectUrl,
      redirectMode: "REDIRECT",
      callbackUrl,
      mobileNumber: activeBooking.phone,
      paymentInstrument: {
        type: "UPI_INTENT",
      },
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const checksum = buildChecksum(encodedPayload + PHONEPE_PAY_PATH, config.saltKey, config.saltIndex);
    const paymentResponse = await axios.post(
      `${PHONEPE_BASE_URL}${PHONEPE_PAY_PATH}`,
      { request: encodedPayload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
          "X-MERCHANT-ID": config.merchantId,
        },
      },
    );
    const phonePeRedirectUrl = getRedirectUrl(paymentResponse.data);

    if (!phonePeRedirectUrl) {
      await supabase
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", activeBooking.id);
        
      return response.status(502).json({
        success: false,
        error: "PhonePe did not return a redirect URL",
        bookingId: activeBooking.id,
      });
    }

    return response.json({
      success: true,
      bookingId: activeBooking.id,
      transactionId,
      redirectUrl: phonePeRedirectUrl,
    });
  } catch (error: any) {
    if (activeBooking) {
      await supabase
        .from("bookings")
        .update({ payment_status: "failed" })
        .eq("id", activeBooking.id);
    }

    if (error instanceof BookingValidationError) {
      return response.status(error.status).json({
        success: false,
        error: error.message,
        bookingId: activeBooking?.id,
      });
    }

    const bookingId = error?.response?.data?.bookingId || activeBooking?.id;
    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      "Failed to initiate PhonePe payment";

    return response.status(500).json({
      success: false,
      error: errorMessage,
      bookingId,
    });
  }
}

export async function getPaymentConfig(_request: AuthenticatedRequest, response: Response): Promise<any> {
  const hotelUpiDetails = getHotelUpiDetails();
  const hotelContactDetails = getHotelContactDetails();

  return response.json({
    success: true,
    payment: {
      phonePeEnabled: Boolean(getPhonePeConfig()),
      manualUpiEnabled: Boolean(hotelUpiDetails.upiId),
      payAtHotelEnabled: true,
      ...hotelUpiDetails,
      ...hotelContactDetails,
    },
  });
}

export async function getPhonePePaymentStatus(request: AuthenticatedRequest, response: Response): Promise<any> {
  try {
    const transactionId = request.params.transactionId;
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (error || !booking) {
      return response.status(404).json({ success: false, error: "Booking not found" });
    }

    if (booking.user_id !== request.auth?.userId) {
      return response.status(403).json({ success: false, error: "Access denied" });
    }

    const syncedBooking = await syncPhonePeBooking(transactionId);

    return response.json({
      success: true,
      paymentStatus: syncedBooking.paymentStatus,
      booking: adaptBooking(syncedBooking.booking),
      phonePe: syncedBooking.statusResponse,
    });
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to fetch payment status";

    return response.status(500).json({ success: false, error: message });
  }
}

export async function handlePhonePeCallback(request: AuthenticatedRequest, response: Response): Promise<any> {
  try {
    await syncPhonePeBooking(request.params.transactionId);
  } catch (error) {
    console.error("PhonePe callback sync failed:", error);
  }

  return response.json({ success: true });
}
