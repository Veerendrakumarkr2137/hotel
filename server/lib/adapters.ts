export function adaptRoom(room: any) {
  if (!room) return null;
  return {
    ...room,
    roomType: room.room_type,
    availableRooms: room.available_rooms,
  };
}

export function adaptBooking(booking: any) {
  if (!booking) return null;
  
  // Recursively adapt nested roomId and userId if they are objects
  let adaptedRoom = booking.roomId;
  if (adaptedRoom && typeof adaptedRoom === "object") {
    adaptedRoom = adaptRoom(adaptedRoom);
  }
  
  let adaptedUser = booking.userId;
  if (adaptedUser && typeof adaptedUser === "object") {
    adaptedUser = {
      ...adaptedUser,
    };
  }

  return {
    ...booking,
    userId: adaptedUser || booking.user_id,
    roomId: adaptedRoom || booking.room_id,
    bookingRef: booking.booking_ref,
    checkInDate: booking.check_in_date,
    checkOutDate: booking.check_out_date,
    totalPrice: Number(booking.total_price),
    transactionId: booking.transaction_id,
    paymentStatus: booking.payment_status,
    bookingStatus: booking.booking_status,
    paymentMethod: booking.payment_method,
    paymentId: booking.payment_id,
    orderId: booking.order_id,
    signature: booking.signature,
    paymentSubmittedAt: booking.payment_submitted_at,
    paymentVerifiedAt: booking.payment_verified_at,
    bookingConfirmedAt: booking.booking_confirmed_at,
    checkedInAt: booking.checked_in_at,
    checkedOutAt: booking.checked_out_at,
    cancelledAt: booking.cancelled_at,
    createdAt: booking.created_at,
  };
}
