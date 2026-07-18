import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { supabase } from "../lib/supabaseClient";
import {
  BookingValidationError,
  ensureRoomAvailability,
  validateBookingInput,
} from "../lib/bookingValidation";
import { getFrontendUrl, getHotelContactDetails, getHotelUpiDetails } from "../lib/runtimeConfig";
import { normalizeEmail } from "../lib/userEmail";
import { adaptBooking } from "../lib/adapters";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "test_key",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "test_secret",
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("Email transporter verification failed:", error);
  }
});

function getBookingFrontendUrl() {
  return getFrontendUrl();
}

function getUpiId() {
  return getHotelUpiDetails().upiId || "your-upi-id@phonepe";
}

function getSupportContactSummary() {
  const contactDetails = getHotelContactDetails();
  const parts = [
    contactDetails.whatsAppNumber
      ? `WhatsApp: ${contactDetails.supportPhone || contactDetails.whatsAppNumber}`
      : "",
    contactDetails.supportEmail ? `Email: ${contactDetails.supportEmail}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function handleBookingError(error: unknown, response: Response, fallbackMessage: string) {
  if (error instanceof BookingValidationError) {
    return response.status(error.status).json({ success: false, error: error.message });
  }

  return response.status(500).json({ success: false, error: fallbackMessage });
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildBookingEmailHTML({
  name,
  bookingRef,
  roomTitle,
  checkInDate,
  checkOutDate,
  guests,
  totalPrice,
  headline,
  message,
  actionLabel,
  actionUrl,
  secondaryActionLabel,
  secondaryActionUrl,
  extraInfo,
}: {
  name: string;
  bookingRef: string;
  roomTitle: string;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
  totalPrice: number;
  headline: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  secondaryActionLabel?: string;
  secondaryActionUrl?: string;
  extraInfo?: string;
}) {
  const checkIn = formatDate(checkInDate);
  const checkOut = formatDate(checkOutDate);
  const amount = `Rs. ${totalPrice.toFixed(2)}`;

  return `
    <html>
      <body style="margin:0;padding:0;font-family:system-ui, -apple-system, 'Segoe UI', sans-serif; background:#f4f6f9;">
        <center style="width:100%;background:#f4f6f9;padding:40px 0;">
          <table width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#0b1b3d;padding:24px 32px;color:#ffffff;text-align:center;">
                <h1 style="margin:0;font-size:24px;letter-spacing:0.5px;">Ashok Inn</h1>
                <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Booking Confirmation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <h2 style="margin:0 0 12px;font-size:20px;color:#0b1b3d;">${headline}</h2>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">Hi ${name},</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${message}</p>

                <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Booking ref</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${bookingRef}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Room</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${roomTitle}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Dates</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${checkIn} to ${checkOut}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Guests</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${guests}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Amount</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${amount}</span>
                    </td>
                  </tr>
                </table>

                ${(actionUrl || secondaryActionUrl) ? `
                  <div style="text-align:center;margin-bottom:24px;">
                    ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#0b1b3d;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600;margin:0 6px 12px;">${actionLabel || "View details"}</a>` : ""}
                    ${secondaryActionUrl ? `<a href="${secondaryActionUrl}" style="display:inline-block;padding:12px 24px;background:#ffffff;color:#0b1b3d;border:1px solid #cbd5e1;border-radius:999px;text-decoration:none;font-weight:600;margin:0 6px 12px;">${secondaryActionLabel || "Open booking"}</a>` : ""}
                  </div>
                ` : ""}

                ${extraInfo ? `<div style="font-size:13px;line-height:1.6;color:#475569;padding:14px 16px;background:#f8fafc;border-radius:12px;">${extraInfo}</div>` : ""}

                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If you have any questions, reply to this email and we'll help you right away.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#0b1b3d;padding:18px 32px;text-align:center;color:#cbd5e1;font-size:12px;">
                (c) ${new Date().getFullYear()} Ashok Inn. All rights reserved.
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>
  `;
}

function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string; }) {
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
  }, (err, info) => {
    if (err) {
      console.error("Email error:", err);
    } else {
      console.log("Email sent:", info?.response);
    }
  });
}

export const createRazorpayOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: "A valid amount is required" });
    }

    const options = {
      amount: amount * 100, // Razorpay works in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    return res.json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to create order" });
  }
};

export const searchBooking = async (req: Request, res: Response): Promise<any> => {
  try {
    const bookingRef = String(req.body?.bookingRef || "").trim();
    const email = normalizeEmail(String(req.body?.email || ""));

    if (!bookingRef || !email) {
      return res.status(400).json({ success: false, error: "Booking reference and email are required" });
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .ilike("booking_ref", bookingRef)
      .ilike("email", email)
      .maybeSingle();

    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    const roomTitle = booking.roomId?.title || "Room";

    return res.json({
      success: true,
      booking: {
        bookingRef: booking.booking_ref,
        roomType: roomTitle,
        checkIn: booking.check_in_date,
        checkOut: booking.check_out_date,
        guests: booking.guests,
        status: booking.booking_status,
      },
    });
  } catch (error) {
    console.error("Search booking error:", error);
    return res.status(500).json({ success: false, error: "Failed to search booking" });
  }
};

export const createPayAtHotelBooking = async (req: any, res: Response): Promise<any> => {
  try {
    const { bookingData } = req.body;
    const { roomId } = bookingData || {};
    
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ success: false, error: "Room not found" });
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
        user_id: req.auth?.userId,
        room_id: roomId,
        name: validatedBooking.name,
        email: validatedBooking.email,
        phone: validatedBooking.phone,
        check_in_date: validatedBooking.checkInDate.toISOString(),
        check_out_date: validatedBooking.checkOutDate.toISOString(),
        guests: validatedBooking.guests,
        total_price: validatedBooking.totalPrice,
        payment_status: "pending",
        booking_status: "confirmed",
        payment_method: "pay_at_hotel",
      })
      .select()
      .single();

    if (insertError || !booking) {
      throw insertError || new Error("Failed to insert booking record");
    }

    // Send email asynchronously without blocking the response
    const bookingUrl = `${getBookingFrontendUrl()}/my-bookings`;
    const payNowUrl = `${getBookingFrontendUrl()}/payment/${booking.id}`;
    const html = buildBookingEmailHTML({
      name: validatedBooking.name,
      bookingRef,
      roomTitle: room.title,
      checkInDate: validatedBooking.checkInDate,
      checkOutDate: validatedBooking.checkOutDate,
      guests: validatedBooking.guests,
      totalPrice: validatedBooking.totalPrice,
      headline: "Your booking is confirmed!",
      message: "Thanks for booking with Ashok Inn. Your reservation is confirmed and you can pay at the hotel upon arrival. If you want a faster check-in experience, you can also pay online before you arrive.",
      actionLabel: "Pay now to save time",
      actionUrl: payNowUrl,
      secondaryActionLabel: "View my bookings",
      secondaryActionUrl: bookingUrl,
      extraInfo: "Paying now is optional. Your room is already confirmed, and you can still choose to pay at the hotel.",
    });

    sendEmail({
      to: validatedBooking.email,
      subject: "Booking Confirmed - Ashok Inn",
      html,
      text: `Hello ${validatedBooking.name}, your booking for room ${room.title} is confirmed. Booking Ref: ${bookingRef}. Total Amount: Rs. ${validatedBooking.totalPrice}. You can pay at the hotel upon arrival or pay now to save time here: ${payNowUrl}`,
    });

    return res.status(201).json({ success: true, booking: adaptBooking(booking) });
  } catch (error) {
    return handleBookingError(error, res, "Booking creation failed");
  }
};

export const createManualBooking = async (req: any, res: Response): Promise<any> => {
  try {
    const { bookingData } = req.body;
    const { roomId } = bookingData || {};
    
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ success: false, error: "Room not found" });
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
        user_id: req.auth?.userId,
        room_id: roomId,
        name: validatedBooking.name,
        email: validatedBooking.email,
        phone: validatedBooking.phone,
        check_in_date: validatedBooking.checkInDate.toISOString(),
        check_out_date: validatedBooking.checkOutDate.toISOString(),
        guests: validatedBooking.guests,
        total_price: validatedBooking.totalPrice,
        payment_status: "pending",
        booking_status: "pending_payment",
        payment_method: "manual_upi",
      })
      .select()
      .single();

    if (insertError || !booking) {
      throw insertError || new Error("Failed to insert booking record");
    }

    // Send email asynchronously without blocking the response
    const paymentUrl = `${getBookingFrontendUrl()}/payment/${booking.id}`;
    const supportContactSummary = getSupportContactSummary();
    const html = buildBookingEmailHTML({
      name: validatedBooking.name,
      bookingRef,
      roomTitle: room.title,
      checkInDate: validatedBooking.checkInDate,
      checkOutDate: validatedBooking.checkOutDate,
      guests: validatedBooking.guests,
      totalPrice: validatedBooking.totalPrice,
      headline: "Your booking is almost complete",
      message: `Please complete payment via UPI to continue your reservation. Your UPI ID is <strong>${getUpiId()}</strong>. After payment, use the confirmation options on your payment page to message the hotel on WhatsApp or email with your booking reference and payment proof.`,
      actionLabel: "View payment instructions",
      actionUrl: paymentUrl,
      extraInfo: supportContactSummary
        ? `Manual UPI payments are verified by hotel staff before the booking is marked as paid. Contact options: ${supportContactSummary}.`
        : "Manual UPI payments are verified by hotel staff before the booking is marked as paid.",
    });

    sendEmail({
      to: validatedBooking.email,
      subject: "Complete your payment - Ashok Inn",
      html,
      text: `Hello ${validatedBooking.name}, please complete payment of Rs. ${validatedBooking.totalPrice} to UPI ID ${getUpiId()}. Booking Ref: ${bookingRef}. After payment, use the payment page to confirm with the hotel on WhatsApp or email so staff can verify it.`,
    });

    return res.status(201).json({ success: true, booking: adaptBooking(booking) });
  } catch (error) {
    return handleBookingError(error, res, "Booking creation failed");
  }
};

export const getBooking = async (req: any, res: Response): Promise<any> => {
  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    if (booking.user_id !== req.auth?.userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const adapted = adaptBooking(booking);

    return res.json({
      success: true,
      booking: {
        ...adapted,
        ...getHotelUpiDetails(),
        ...getHotelContactDetails(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to load booking" });
  }
};

export const confirmPayment = async (req: any, res: Response): Promise<any> => {
  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    if (booking.user_id !== req.auth?.userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (booking.payment_method === "manual_upi") {
      if (["cancelled", "completed"].includes(booking.booking_status)) {
        return res.status(400).json({
          success: false,
          error: "This booking can no longer accept payment submissions.",
        });
      }

      if (booking.payment_status === "paid") {
        return res.status(400).json({
          success: false,
          error: "This payment has already been verified by hotel staff.",
        });
      }

      let updatedBooking = booking;
      if (booking.payment_status !== "submitted") {
        const { data: updated, error: updateError } = await supabase
          .from("bookings")
          .update({
            payment_status: "submitted",
            booking_status: "pending_payment",
          })
          .eq("id", booking.id)
          .select("*, roomId:rooms(*)")
          .single();

        if (updateError) throw updateError;
        updatedBooking = updated;
      }

      return res.json({
        success: true,
        message: "Payment submitted successfully. Hotel staff will verify it shortly.",
        booking: adaptBooking(updatedBooking),
      });
    }

    return res.status(400).json({
      success: false,
      error: "This booking does not support manual payment confirmation.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to confirm payment" });
  }
};

export const verifyPaymentAndBook = async (req: any, res: Response): Promise<any> => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod = "card",
      bookingData
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "test_secret")
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ success: false, error: "Invalid API signature" });
    }

    const { roomId } = bookingData || {};
    
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError || !room) {
      return res.status(404).json({ success: false, error: "Room not found" });
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
        user_id: req.auth?.userId,
        room_id: roomId,
        name: validatedBooking.name,
        email: validatedBooking.email,
        phone: validatedBooking.phone,
        check_in_date: validatedBooking.checkInDate.toISOString(),
        check_out_date: validatedBooking.checkOutDate.toISOString(),
        guests: validatedBooking.guests,
        total_price: validatedBooking.totalPrice,
        payment_status: "paid",
        booking_status: "confirmed",
        payment_method: paymentMethod || "card",
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        signature: razorpay_signature,
      })
      .select()
      .single();

    if (insertError || !booking) {
      throw insertError || new Error("Failed to create booking");
    }

    // Send email asynchronously without blocking the response
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: validatedBooking.email,
      subject: "Booking Confirmation - Ashok Inn",
      text: `Hello ${validatedBooking.name}, your booking for room ${room.title} is confirmed. Booking Ref: ${bookingRef}. Total Paid: Rs. ${validatedBooking.totalPrice}.`,
    }, (err, info) => {
      if (err) {
        console.error("Email error:", err);
      } else {
        console.log("Email sent:", info?.response);
      }
    });

    return res.status(201).json({ success: true, booking: adaptBooking(booking) });
  } catch (error) {
    return handleBookingError(error, res, "Payment verification failed");
  }
};

export const getMyBookings = async (req: any, res: Response): Promise<any> => {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .eq("user_id", req.auth?.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const adapted = (bookings || []).map(adaptBooking);
    return res.json({ success: true, bookings: adapted });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
};

export const getAllBookings = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*), userId:users(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const adapted = (bookings || []).map(adaptBooking);
    return res.json({ success: true, bookings: adapted });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
};

export const deleteBooking = async (req: Request, res: Response): Promise<any> => {
   try {
     const { data: booking, error } = await supabase
       .from("bookings")
       .delete()
       .eq("id", req.params.id)
       .select()
       .maybeSingle();

     if (error || !booking) return res.status(404).json({ success: false, error: "Not found" });
     return res.json({ success: true, message: "Deleted" });
   } catch(e) {
     return res.status(500).json({ success: false, error: "Failed to delete" });
   }
};

export const verifyManualUpiPayment = async (req: any, res: Response): Promise<any> => {
  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, roomId:rooms(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    if (booking.payment_method !== "manual_upi") {
      return res.status(400).json({
        success: false,
        error: "Only manual UPI bookings can be verified from this action.",
      });
    }

    if (["cancelled", "completed"].includes(booking.booking_status)) {
      return res.status(400).json({
        success: false,
        error: "This booking can no longer be verified.",
      });
    }

    if (booking.payment_status === "paid") {
      return res.status(400).json({
        success: false,
        error: "This manual UPI payment has already been verified.",
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        booking_status: "confirmed",
        payment_id: booking.payment_id || `manual-upi-${Date.now()}`,
      })
      .eq("id", booking.id)
      .select("*, roomId:rooms(*)")
      .single();

    if (updateError || !updated) {
      throw updateError || new Error("Failed to update status");
    }

    const roomTitle = updated.roomId?.title || "Room";
    const bookingUrl = `${getBookingFrontendUrl()}/booking-confirmation/${updated.id}`;
    const html = buildBookingEmailHTML({
      name: updated.name,
      bookingRef: updated.booking_ref,
      roomTitle,
      checkInDate: new Date(updated.check_in_date),
      checkOutDate: new Date(updated.check_out_date),
      guests: updated.guests,
      totalPrice: Number(updated.total_price),
      headline: "Your manual UPI payment has been verified",
      message: "Our team has verified your UPI transfer. Your booking is now fully confirmed and ready for your stay.",
      actionLabel: "View booking confirmation",
      actionUrl: bookingUrl,
      extraInfo: "Please keep your booking reference handy when you arrive at the hotel.",
    });

    sendEmail({
      to: updated.email,
      subject: "Manual UPI payment verified - Ashok Inn",
      html,
      text: `Hello ${updated.name}, your manual UPI payment for booking ${updated.booking_ref} has been verified. Your booking is now confirmed.`,
    });

    return res.json({
      success: true,
      message: "Manual UPI payment verified successfully.",
      booking: adaptBooking(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to verify manual UPI payment" });
  }
};

export const updateBookingStatus = async (req: Request, res: Response): Promise<any> => {
   try {
      const { status } = req.body;
      const allowedStatuses = new Set(["pending", "pending_payment", "confirmed", "checked_in", "cancelled", "completed"]);

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({ success: false, error: "Invalid booking status" });
      }

      const { data: booking, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();

      if (error || !booking) {
        return res.status(404).json({ success: false, error: "Not found" });
      }

      if (booking.booking_status === status) {
        return res.json({ success: true, booking: adaptBooking(booking) });
      }

      const allowedTransitions = {
        pending: new Set(["pending_payment", "confirmed", "cancelled"]),
        pending_payment: new Set(["confirmed", "cancelled"]),
        confirmed: new Set(["checked_in", "cancelled"]),
        checked_in: new Set(["completed"]),
        cancelled: new Set<string>(),
        completed: new Set<string>(),
      } as const;

      const nextStatuses = allowedTransitions[booking.booking_status as keyof typeof allowedTransitions];

      if (!nextStatuses || !nextStatuses.has(status)) {
        return res.status(400).json({
          success: false,
          error: "This booking cannot move to that status.",
        });
      }

      const canConfirmWithoutPaidStatus = booking.payment_method === "pay_at_hotel";

      if (status === "confirmed" && booking.payment_status !== "paid" && !canConfirmWithoutPaidStatus) {
        return res.status(400).json({
          success: false,
          error: "This booking cannot be confirmed until the payment is verified.",
        });
      }

      if (status === "checked_in" && booking.booking_status !== "confirmed") {
        return res.status(400).json({
          success: false,
          error: "Only confirmed bookings can be checked in.",
        });
      }

      const updates: Record<string, any> = {
        booking_status: status,
      };

      if (status === "checked_in" && booking.payment_method === "pay_at_hotel" && booking.payment_status !== "paid") {
        updates.payment_status = "paid";
        updates.payment_id = booking.payment_id || `hotel-desk-${Date.now()}`;
      }

      const { data: updated, error: updateError } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", booking.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.json({ success: true, booking: adaptBooking(updated) });
   } catch (e) {
     return res.status(500).json({ success: false, error: "Failed to update" });
   }
};

export const cancelBooking = async (req: any, res: Response): Promise<any> => {
  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // Verify the booking belongs to the logged-in user
    if (booking.user_id !== req.auth?.userId) {
      return res.status(403).json({ success: false, error: "You can only cancel your own bookings" });
    }

    // Can only cancel confirmed bookings
    if (booking.booking_status !== "confirmed" && booking.booking_status !== "pending_payment") {
      return res.status(400).json({ success: false, error: "This booking cannot be cancelled" });
    }

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({
        booking_status: "cancelled",
      })
      .eq("id", booking.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError || new Error("Failed to cancel");
    }

    // Send cancellation email
    const { data: room } = await supabase
      .from("rooms")
      .select("title")
      .eq("id", updated.room_id)
      .maybeSingle();

    const html = buildBookingEmailHTML({
      name: updated.name,
      bookingRef: updated.booking_ref,
      roomTitle: room?.title || "Room",
      checkInDate: new Date(updated.check_in_date),
      checkOutDate: new Date(updated.check_out_date),
      guests: updated.guests,
      totalPrice: Number(updated.total_price),
      headline: "Booking cancelled",
      message: "Your booking has been successfully cancelled. If you have any questions, please contact us.",
      extraInfo: "We hope to see you at Ashok Inn soon!",
    });

    sendEmail({
      to: updated.email,
      subject: "Booking Cancelled - Ashok Inn",
      html,
      text: `Your booking ${updated.booking_ref} has been cancelled.`,
    });

    return res.json({ success: true, booking: adaptBooking(updated) });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to cancel booking" });
  }
};
