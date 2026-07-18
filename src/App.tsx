import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "motion/react";
import { GoogleOAuthProvider } from "@react-oauth/google";

import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AdminSidebar from "./admin/AdminSidebar";
import { pageReveal, pageSlide } from "./lib/animations";

// Lazy loading pages
const Home = lazy(() => import("./pages/Home"));
const Rooms = lazy(() => import("./pages/Rooms"));
const RoomDetails = lazy(() => import("./pages/RoomDetails"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"));
const Profile = lazy(() => import("./pages/Profile"));
const Payment = lazy(() => import("./pages/Payment"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Contact = lazy(() => import("./pages/Contact"));
const Gallery = lazy(() => import("./pages/Gallery"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MyBookings = lazy(() => import("./pages/MyBookings"));

// Admin pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const AdminRooms = lazy(() => import("./admin/AdminRooms"));
const AdminBookings = lazy(() => import("./admin/AdminBookings"));
const AdminCheckIn = lazy(() => import("./admin/AdminCheckIn"));
const AdminCheckOut = lazy(() => import("./admin/AdminCheckOut"));
const AdminGallery = lazy(() => import("./admin/AdminGallery"));

function PageLoader({ fullHeight = false }: { fullHeight?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${fullHeight ? "h-full min-h-[40vh]" : "min-h-[50vh]"}`}>
      <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-white/70 bg-white/80 px-8 py-6 shadow-xl shadow-slate-200/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              animate={{ y: [0, -10, 0], opacity: [0.45, 1, 0.45], scale: [1, 1.08, 1] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: dot * 0.12,
              }}
              className="h-3 w-3 rounded-full bg-blue-600/80"
            />
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Loading</p>
      </div>
    </div>
  );
}

function MainLayout() {
  const location = useLocation();
  
  return (
    <div className="flex flex-col min-h-screen font-sans bg-slate-50 text-slate-900">
      <Navbar />
      <main className="relative flex-grow overflow-hidden pt-[80px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${location.pathname}${location.search}`}
            {...pageReveal}
            className="min-h-full"
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${location.pathname}${location.search}`}
            {...pageSlide}
            className="h-full"
          >
            <Suspense fallback={<PageLoader fullHeight />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const appContent = (
    <AuthProvider>
      <Router>
        <ToastContainer position="top-right" autoClose={3000} aria-label="Notifications" />
        <Routes>
          {/* Main Website Flow */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/room/:id" element={<RoomDetails />} />
            <Route path="/book/:id" element={<BookingPage />} />
            <Route path="/booking-confirmation/:id" element={<BookingConfirmation />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/contact" element={<Contact />} />
            
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/payment/:id" element={<Payment />} />
            <Route path="/my-bookings" element={<MyBookings />} />
          </Route>

          {/* Admin Flow */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="check-in" element={<AdminCheckIn />} />
            <Route path="check-out" element={<AdminCheckOut />} />
            <Route path="gallery" element={<AdminGallery />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );

  if (!googleClientId) {
    return appContent;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {appContent}
    </GoogleOAuthProvider>
  );
}
