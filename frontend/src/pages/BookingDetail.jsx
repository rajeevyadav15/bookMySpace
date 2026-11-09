import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { formatDay, formatPrice, formatTime } from "../utils/format";
import StatusBadge from "../components/StatusBadge";

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setBooking(null);
    setError("");

    api(`/bookings/${id}`, { signal: controller.signal })
      .then((data) => setBooking(data.booking))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <div>
        <p className="text-red-300">{error}</p>
        <Link to="/bookings" className="mt-3 inline-block text-rose-400 hover:underline">
          My bookings
        </Link>
      </div>
    );
  }

  if (!booking) return <p className="text-slate-400">Loading ticket...</p>;

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/bookings" className="text-sm text-slate-400 hover:text-white">
        ← My bookings
      </Link>

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{booking.movie_title}</h1>
          <StatusBadge status={booking.status} />
        </div>

        <p className="mt-2 text-slate-300">
          {booking.theatre_name}, {booking.city}
        </p>
        <p className="text-slate-400">
          {booking.screen_name} · {formatDay(booking.start_time)}, {formatTime(booking.start_time)}
        </p>

        <div className="my-5 border-t border-dashed border-slate-700" />

        <div className="flex flex-wrap gap-2">
          {booking.seats.map((s) => (
            <span key={s.seatId} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
              {s.row}
              {s.number}
              <span className="ml-1 text-xs text-slate-400">({s.type})</span>
            </span>
          ))}
        </div>

        <p className="mt-5 text-lg font-semibold">{formatPrice(booking.total_amount)}</p>
        <p className="mt-4 break-all text-xs text-slate-500">Booking ID: {booking.id}</p>

        {booking.status === "confirmed" && (
          <p className="mt-3 text-sm text-emerald-300">
            Ticket details have also been sent to your email.
          </p>
        )}
      </div>
    </div>
  );
}