import { supabase } from "./supabaseClient";
import { ACTIVE_BOOKING_STATUSES } from "./bookingLifecycle";
import { RoomRecord } from "../types/database";

type RawBookingData = {
  roomId?: string;
  name?: string;
  email?: string;
  phone?: string;
  checkInDate?: string | Date;
  checkOutDate?: string | Date;
  guests?: number | string;
  totalPrice?: number;
};

export class BookingValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BookingValidationError";
    this.status = status;
  }
}

function parseDate(value: string | Date | undefined, label: string) {
  if (!value) {
    throw new BookingValidationError(`${label} is required`);
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BookingValidationError(`${label} is invalid`);
  }

  return parsed;
}

function getStartOfDay(value: Date) {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function calculateNights(checkInDate: Date, checkOutDate: Date) {
  const diff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export async function validateBookingInput(room: RoomRecord, bookingData?: RawBookingData) {
  if (!bookingData) {
    throw new BookingValidationError("Booking details are required");
  }

  const name = bookingData.name?.trim();
  const email = bookingData.email?.trim().toLowerCase();
  const phone = bookingData.phone?.trim();
  const guests = Number(bookingData.guests);

  if (!name || !email || !phone) {
    throw new BookingValidationError("Name, email, and phone are required");
  }

  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new BookingValidationError("Please provide a valid email address");
  }

  if (!Number.isInteger(guests) || guests <= 0) {
    throw new BookingValidationError("Guest count must be at least 1");
  }

  if (guests > room.capacity) {
    throw new BookingValidationError(`This room allows up to ${room.capacity} guest(s)`);
  }

  if (room.available_rooms <= 0) {
    throw new BookingValidationError("This room is currently unavailable", 409);
  }

  const checkInDate = getStartOfDay(parseDate(bookingData.checkInDate, "Check-in date"));
  const checkOutDate = getStartOfDay(parseDate(bookingData.checkOutDate, "Check-out date"));
  const today = getStartOfDay(new Date());

  if (checkInDate < today) {
    throw new BookingValidationError("Check-in date cannot be in the past");
  }

  if (checkOutDate <= checkInDate) {
    throw new BookingValidationError("Check-out date must be after check-in date");
  }

  const nights = calculateNights(checkInDate, checkOutDate);

  if (nights <= 0) {
    throw new BookingValidationError("Please select valid booking dates");
  }

  return {
    name,
    email,
    phone,
    guests,
    checkInDate,
    checkOutDate,
    nights,
    totalPrice: nights * room.price,
  };
}

export async function ensureRoomAvailability(
  roomId: string,
  checkInDate: Date,
  checkOutDate: Date,
  availableRooms: number,
  excludeBookingId?: string,
) {
  let query = supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .in("booking_status", ACTIVE_BOOKING_STATUSES)
    .lt("check_in_date", checkOutDate.toISOString())
    .gt("check_out_date", checkInDate.toISOString());

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const overlappingBookings = count || 0;

  if (overlappingBookings >= availableRooms) {
    throw new BookingValidationError("Selected dates are no longer available for this room", 409);
  }
}
