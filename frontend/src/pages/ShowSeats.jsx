import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import SeatMap from "../components/SeatMap";
import FormError from "../components/FormError";
import { buttonCls } from "../components/styles";
import useCountdown from "../hooks/useCountdown";
import { formatDay, formatPrice, formatTime } from "../utils/format";
import { formatCountdown } from "../utils/time";
import { MAX_SEATS, pruneSelection, seatTotal } from "../utils/seats";
import { clearHold, loadHold, saveHold } from "../utils/holdStore";
import { loadRazorpay } from "../utils/razorpay";

// Must match backend PAYMENT_MODE
const MOCK_PAYMENT = import.meta.env.VITE_PAYMENT_MODE === "mock";
const REFRESH_MS = 10000;

const seatLabel = (s) => `${s.row ?? s.row_label}${s.number ?? s.seat_number}`;

export default function ShowSeats() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState([]);
  const [hold, setHold] = useState(null);
  const [busy, setBusy] = useState(""); // "", "holding", "paying", "releasing"
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(null);

  const busyRef = useRef("");
  const verifyingRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const fetchShow = useCallback(
    async (signal) => {
      try {
        const res = await api(`/shows/${id}`, { signal });
        setData({ show: res.show, seats: res.seats });
        // Remove seats that someone else took meanwhile
        setSelected((cur) => {
          const next = pruneSelection(cur, res.seats);
          return next.length === cur.length ? cur : next;
        });
        setLoadError("");
      } catch (err) {
        if (err.name !== "AbortError") setLoadError(err.message);
      }
    },
    [id]
  );

  // New show: reset everything and restore my hold (if any)
  useEffect(() => {
    setData(null);
    setLoadError("");
    setSelected([]);
    setNotice("");
    setError(null);
    setHold(loadHold(id, user.id));
  }, [id, user.id]);

  // Load seats now and refresh every 10 seconds
  useEffect(() => {
    const controller = new AbortController();
    fetchShow(controller.signal);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !busyRef.current) {
        fetchShow(controller.signal);
      }
    }, REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [fetchShow]);

  const secondsLeft = useCountdown(hold ? hold.expiresAt : null);

  // Hold timer ended. Not while payment popup is open.
  useEffect(() => {
    if (
      hold &&
      secondsLeft === 0 &&
      new Date(hold.expiresAt).getTime() <= Date.now() &&
      busy !== "paying"
    ) {
      clearHold(id);
      setHold(null);
      setNotice("Your seat hold expired. Please select seats again.");
      fetchShow();
    }
  }, [secondsLeft, hold, busy, id, fetchShow]);

  const mineIds = useMemo(
    () => new Set(hold ? hold.seats.map((s) => s.id) : []),
    [hold]
  );

  const selectedSeats = useMemo(
    () => (data ? data.seats.filter((s) => selected.includes(s.id)) : []),
    [data, selected]
  );

  if (!data) {
    return loadError ? (
      <div>
        <p className="text-red-300">{loadError}</p>
        <Link to="/" className="mt-3 inline-block text-rose-400 hover:underline">
          Back to movies
        </Link>
      </div>
    ) : (
      <p className="text-slate-400">Loading seats...</p>
    );
  }

  const { show, seats } = data;
  const started = new Date(show.start_time).getTime() <= Date.now();
  const total = seatTotal(selectedSeats);

  function toggleSeat(seat) {
    setError(null);
    setNotice("");

    if (!selected.includes(seat.id) && selected.length >= MAX_SEATS) {
      setNotice(`You can select up to ${MAX_SEATS} seats.`);
      return;
    }

    setSelected((cur) =>
      cur.includes(seat.id) ? cur.filter((x) => x !== seat.id) : [...cur, seat.id]
    );
  }

  async function holdSelected() {
    setBusy("holding");
    setError(null);
    setNotice("");

    try {
      const res = await api("/bookings/hold", {
        method: "POST",
        body: { showId: id, seatIds: selected },
      });
      const newHold = { ...res.hold, userId: user.id };
      saveHold(id, newHold);
      setHold(newHold);
      setSelected([]);
      fetchShow();
    } catch (err) {
      setError(err);
      if (err.status === 409) fetchShow(); // seat map was old
    } finally {
      setBusy("");
    }
  }

  async function releaseHold() {
    if (!hold) return;
    setBusy("releasing");
    setError(null);

    try {
      await api(`/bookings/hold/${hold.holdId}`, { method: "DELETE" });
    } catch (err) {
      // 404 means hold already expired, which is fine
      if (err.status !== 404) {
        setError(err);
        setBusy("");
        return;
      }
    }

    clearHold(id);
    setHold(null);
    setBusy("");
    fetchShow();
  }

  function goToBooking(bookingId) {
    clearHold(id);
    navigate(`/bookings/${bookingId}`, { replace: true });
  }

  function handlePayError(err) {
    setBusy("");

    if (err.status === 410) {
      clearHold(id);
      setHold(null);
      setNotice("Your seat hold expired. Please select seats again.");
      fetchShow();
      return;
    }
    setError(err);
  }

  async function verifyPayment(response) {
    verifyingRef.current = true;
    setBusy("paying");

    try {
      const res = await api("/payments/verify", {
        method: "POST",
        body: {
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        },
      });
      goToBooking(res.booking.id);
    } catch (err) {
      verifyingRef.current = false;
      clearHold(id);
      setHold(null);
      setBusy("");

      setNotice(
        err.status === 409
          ? err.message
          : `Payment received but the booking is not confirmed yet. Check My Bookings in a minute. If it is missing, contact support with payment id ${response.razorpay_payment_id}.`
      );
      fetchShow();
    }
  }

  function openCheckout(order) {
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "BookMySpace",
      description: `${show.movie_title} (${hold.seats.length} seats)`,
      prefill: { name: user.name, email: user.email },
      theme: { color: "#e11d48" },
      handler: (response) => verifyPayment(response),
      modal: {
        // User closed the popup without paying
        ondismiss: () => {
          if (!verifyingRef.current) setBusy("");
        },
      },
    });

    checkout.on("payment.failed", (resp) => {
      setError({
        message:
          (resp && resp.error && resp.error.description) ||
          "Payment failed. You can try again.",
      });
      setBusy("");
    });

    checkout.open();
  }

  async function pay() {
    setBusy("paying");
    setError(null);
    setNotice("");
    verifyingRef.current = false;

    try {
      if (MOCK_PAYMENT) {
        const res = await api("/bookings/confirm", {
          method: "POST",
          body: { holdId: hold.holdId },
        });
        goToBooking(res.booking.id);
        return;
      }

      const { order } = await api("/payments/order", {
        method: "POST",
        body: { holdId: hold.holdId },
      });

      // Backend gave more time to pay, so update the timer
      const extended = { ...hold, expiresAt: order.expiresAt };
      saveHold(id, extended);
      setHold(extended);

      await loadRazorpay();
      openCheckout(order);
    } catch (err) {
      handlePayError(err);
    }
  }

  const locked = Boolean(hold) || busy !== "" || started;

  return (
    <div>
      <Link to={`/movies/${show.movie_id}`} className="text-sm text-slate-400 hover:text-white">
        ← Back to shows
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{show.movie_title}</h1>
      <p className="mt-1 text-sm text-slate-400">
        {show.theatre_name}, {show.city} · {show.screen_name} · {formatDay(show.start_time)},{" "}
        {formatTime(show.start_time)}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Regular {formatPrice(show.price_regular)} · Premium {formatPrice(show.price_premium)}
      </p>

      {started && (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          This show has already started. Booking is closed.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <SeatMap
            seats={seats}
            selectedIds={selected}
            mineIds={mineIds}
            disabled={locked}
            onToggle={toggleSeat}
          />
        </div>

        <aside className="h-fit space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:sticky lg:top-20">
          {notice && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              {notice}
            </p>
          )}
          <FormError error={error} />

          {hold ? (
            <>
              <h2 className="font-semibold">Your seats are on hold</h2>
              <p
                className={`text-3xl font-bold tabular-nums ${
                  secondsLeft < 60 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {formatCountdown(secondsLeft)}
              </p>
              <p className="text-sm text-slate-300">
                {hold.seats.map(seatLabel).join(", ")} ({hold.seats.length} seats)
              </p>
              <p className="text-lg font-semibold">{formatPrice(hold.totalAmount)}</p>

              <button
                className={`${buttonCls} w-full`}
                onClick={pay}
                disabled={busy !== "" || secondsLeft === 0}
              >
                {busy === "paying" ? "Processing..." : `Pay ${formatPrice(hold.totalAmount)}`}
              </button>
              <button
                className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                onClick={releaseHold}
                disabled={busy !== ""}
              >
                {busy === "releasing" ? "Releasing..." : "Release seats"}
              </button>
              {MOCK_PAYMENT && (
                <p className="text-xs text-slate-500">Mock payment mode: no real money.</p>
              )}
            </>
          ) : (
            <>
              <h2 className="font-semibold">Your selection</h2>
              {selectedSeats.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Pick up to {MAX_SEATS} seats from the map.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-300">
                    {selectedSeats.map(seatLabel).join(", ")} ({selectedSeats.length} seats)
                  </p>
                  <p className="text-lg font-semibold">{formatPrice(total)}</p>
                </>
              )}

              <button
                className={`${buttonCls} w-full`}
                onClick={holdSelected}
                disabled={selected.length === 0 || locked}
              >
                {busy === "holding" ? "Holding seats..." : "Hold seats"}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}