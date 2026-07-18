// Database table definitions for Supabase (PostgreSQL)

export interface UserRecord {
  id: string; // UUID
  name: string;
  email: string;
  password?: string;
  role: "user" | "admin";
  password_reset_token_hash?: string | null;
  password_reset_expires_at?: string | null;
  created_at?: string;
}

export interface RoomRecord {
  id: string; // UUID
  title: string;
  description: string;
  price: number;
  images: string[];
  room_type: string;
  capacity: number;
  amenities: string[];
  available_rooms: number;
  created_at?: string;
}

export interface BookingRecord {
  id: string; // UUID
  booking_ref: string;
  user_id: string;
  room_id: string;
  name: string;
  email: string;
  phone: string;
  check_in_date: string;
  check_out_date: string;
  guests: number;
  total_price: number;
  transaction_id?: string | null;
  payment_status: "pending" | "submitted" | "paid" | "failed";
  booking_status: "pending" | "pending_payment" | "confirmed" | "checked_in" | "cancelled" | "completed";
  payment_method: "card" | "upi" | "wallet" | "manual_upi" | "pay_at_hotel" | "PhonePe";
  payment_id?: string | null;
  order_id?: string | null;
  signature?: string | null;
  payment_submitted_at?: string | null;
  payment_verified_at?: string | null;
  booking_confirmed_at?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string;
}
