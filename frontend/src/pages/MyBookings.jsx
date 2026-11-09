import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { qs } from "../utils/qs";
import { formatDay, formatPrice, formatTime } from "../utils/format";
import { canCancel, refundMessage } from "../utils/booking";
import StatusBadge from "../components/StatusBadge";

const LIMIT = 10;

export default function MyBookings() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancelling, setCancelling] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api(`/bookings${qs({ page, limit: LIMIT })}`, { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page]);

  async function cancel(booking) {
    if (!window.confirm("Cancel this booking?")) return;

    setCancelling(booking.id);
    setNotice("");
    setError("");

    try {
      const res = await api(`/bookings/${booking.id}/cancel`, { method: "POST" });
      setData((cur) => ({
        ...cur,
        items: cur.items.map((b) => (b.id === booking.id ? res.booking : b)),
      }));
      setNotice(refundMessage(res.refund));
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling("");
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My bookings</h1>

      {notice && (
        <p className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && !data && <p className="text-slate-400">Loading bookings...</p>}

      {data && data.items.length === 0 && (
        <p className="text-slate-400">
          {page === 1 ? "No bookings yet." : "No more bookings."}{" "}
          <Link to="/" className="text-rose-400 hover:underline">
            Browse movies
          </Link>
        </p>
      )}

      <div className="space-y-4">
        {data &&
          data.items.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{b.movie_title}</h2>
                  <p className="text-sm text-slate-400">
                    {b.theatre_name}, {b.city} · {b.screen_name}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatDay(b.start_time)}, {formatTime(b.start_time)}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>

              <p className="mt-3 text-sm text-slate-300">
                Seats: {b.seats.map((s) => `${s.row}${s.number}`).join(", ")}
              </p>
              <p className="mt-1 font-semibold">{formatPrice(b.total_amount)}</p>

              <div className="mt-3 flex items-center gap-4 text-sm">
                <Link to={`/bookings/${b.id}`} className="text-rose-400 hover:underline">
                  View ticket
                </Link>
                {canCancel(b) && (
                  <button
                    className="text-slate-400 hover:text-red-300 disabled:opacity-50"
                    onClick={() => cancel(b)}
                    disabled={cancelling === b.id}
                  >
                    {cancelling === b.id ? "Cancelling..." : "Cancel booking"}
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {data && (page > 1 || data.items.length === LIMIT) && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <button
            className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700 disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-slate-400">Page {page}</span>
          <button
            className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700 disabled:opacity-40"
            disabled={data.items.length < LIMIT || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}