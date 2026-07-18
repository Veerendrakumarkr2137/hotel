import { Request, Response } from "express";
import { supabase } from "../lib/supabaseClient";
import { buildDashboardStats, getDayRange } from "../lib/dashboardAnalytics";

export const getDashboardStats = async (_request: Request, response: Response): Promise<any> => {
  try {
    const { start, end } = getDayRange();

    // Query helper for exact head counts
    const getCount = async (fromTable: string, configureQuery: (query: any) => any = (q) => q) => {
      const base = supabase.from(fromTable).select("id", { count: "exact", head: true });
      const { count, error } = await configureQuery(base);
      if (error) throw error;
      return count || 0;
    };

    const [
      totalUsers,
      adminCount,
      totalBookings,
      totalRooms,
      revenueData,
      inventoryData,
      pendingPayments,
      manualReviewBookings,
      todayArrivals,
      todayDepartures,
      overdueArrivals,
      inHouseGuests,
      completedStays,
      recentUsersData,
    ] = await Promise.all([
      getCount("users"),
      getCount("users", (q) => q.eq("role", "admin")),
      getCount("bookings"),
      getCount("rooms"),
      supabase.from("bookings").select("total_price").eq("payment_status", "paid"),
      supabase.from("rooms").select("available_rooms"),
      getCount("bookings", (q) =>
        q
          .in("payment_status", ["pending", "submitted"])
          .neq("booking_status", "cancelled")
          .neq("booking_status", "completed")
      ),
      getCount("bookings", (q) =>
        q
          .eq("payment_method", "manual_upi")
          .eq("payment_status", "submitted")
          .neq("booking_status", "cancelled")
          .neq("booking_status", "completed")
      ),
      getCount("bookings", (q) =>
        q
          .eq("booking_status", "confirmed")
          .gte("check_in_date", start.toISOString())
          .lt("check_in_date", end.toISOString())
      ),
      getCount("bookings", (q) =>
        q
          .eq("booking_status", "checked_in")
          .gte("check_out_date", start.toISOString())
          .lt("check_out_date", end.toISOString())
      ),
      getCount("bookings", (q) =>
        q.eq("booking_status", "confirmed").lt("check_in_date", start.toISOString())
      ),
      getCount("bookings", (q) => q.eq("booking_status", "checked_in")),
      getCount("bookings", (q) => q.eq("booking_status", "completed")),
      supabase
        .from("users")
        .select("id, name, email, role, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (revenueData.error) throw revenueData.error;
    if (inventoryData.error) throw inventoryData.error;
    if (recentUsersData.error) throw recentUsersData.error;

    const revenue = revenueData.data
      ? revenueData.data.reduce((sum, item) => sum + Number(item.total_price), 0)
      : 0;

    const totalInventory = inventoryData.data
      ? inventoryData.data.reduce((sum, item) => sum + Number(item.available_rooms), 0)
      : 0;

    const recentUsers = (recentUsersData.data || []).map((user) => ({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
    }));

    const stats = buildDashboardStats({
      totalUsers,
      adminCount,
      totalBookings,
      totalRooms,
      totalInventory,
      revenue,
      pendingPayments,
      manualReviewBookings,
      todayArrivals,
      todayDepartures,
      overdueArrivals,
      inHouseGuests,
      completedStays,
    });

    return response.json({
      success: true,
      stats,
      recentUsers,
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error.message);
    return response.status(500).json({ success: false, error: "Failed to load dashboard stats" });
  }
};

export const getAllUsers = async (_request: Request, response: Response): Promise<any> => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const adaptedUsers = (users || []).map((user) => ({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
    }));

    return response.json({ success: true, users: adaptedUsers });
  } catch (error: any) {
    console.error("Admin users error:", error.message);
    return response.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};
