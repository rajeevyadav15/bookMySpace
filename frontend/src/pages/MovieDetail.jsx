import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { qs } from "../utils/qs";
import { formatDay, formatDuration, formatPrice, formatTime } from "../utils/format";
import useDebounce from "../hooks/useDebounce";
import { inputCls } from "../components/styles";

export default function MovieDetail() {
  const { id } = useParams();

  const [movie, setMovie] = useState(null);
  const [movieError, setMovieError] = useState("");

  const [cityInput, setCityInput] = useState("");
  const [date, setDate] = useState("");
  const [shows, setShows] = useState([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [showsError, setShowsError] = useState("");

  const city = useDebounce(cityInput.trim(), 400);

  useEffect(() => {
    const controller = new AbortController();
    setMovie(null);
    setMovieError("");

    api(`/movies/${id}`, { signal: controller.signal })
      .then((data) => setMovie(data.movie))
      .catch((err) => {
        if (err.name !== "AbortError") setMovieError(err.message);
      });

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setShowsLoading(true);
    setShowsError("");

    api(`/shows${qs({ movieId: id, city, date })}`, { signal: controller.signal })
      .then((data) => setShows(data.shows))
      .catch((err) => {
        if (err.name !== "AbortError") setShowsError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setShowsLoading(false);
      });

    return () => controller.abort();
  }, [id, city, date]);

  // Group shows by theatre
  const groups = useMemo(() => {
    const map = new Map();
    for (const show of shows) {
      if (!map.has(show.theatre_id)) {
        map.set(show.theatre_id, { name: show.theatre_name, city: show.city, shows: [] });
      }
      map.get(show.theatre_id).shows.push(show);
    }
    return [...map.values()];
  }, [shows]);

  if (movieError) {
    return (
      <div>
        <p className="text-red-300">{movieError}</p>
        <Link to="/" className="mt-3 inline-block text-rose-400 hover:underline">
          Back to movies
        </Link>
      </div>
    );
  }

  if (!movie) return <p className="text-slate-400">Loading...</p>;

  return (
    <div>
      <Link to="/" className="text-sm text-slate-400 hover:text-white">
        ← All movies
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <div className="aspect-2/3 w-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {movie.poster_url ? (
            <img src={movie.poster_url} alt={movie.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl font-bold text-slate-600">
              {movie.title.charAt(0)}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold">{movie.title}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {[
              movie.certificate,
              formatDuration(movie.duration_min),
              movie.language,
              movie.release_date,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {movie.genres && movie.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span key={g} className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                  {g}
                </span>
              ))}
            </div>
          )}

          {movie.description && <p className="mt-4 max-w-2xl text-slate-300">{movie.description}</p>}
        </div>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Shows</h2>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          className={`${inputCls} sm:max-w-xs`}
          placeholder="City (for example Raipur)"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
        />
        <input
          type="date"
          className={`${inputCls} sm:max-w-xs`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {date && (
          <button
            className="text-sm text-slate-400 hover:text-white"
            onClick={() => setDate("")}
          >
            Clear date
          </button>
        )}
      </div>

      {showsError && <p className="mt-4 text-red-300">{showsError}</p>}
      {showsLoading && <p className="mt-4 text-slate-400">Loading shows...</p>}

      {!showsLoading && !showsError && groups.length === 0 && (
        <p className="mt-4 text-slate-400">No upcoming shows for this filter.</p>
      )}

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.name} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="font-semibold">
              {group.name} <span className="text-sm font-normal text-slate-400">· {group.city}</span>
            </h3>

            <div className="mt-3 flex flex-wrap gap-3">
              {group.shows.map((show) => (
                <Link
                  key={show.id}
                  to={`/shows/${show.id}`}
                  className="rounded-lg border border-emerald-500/50 px-3 py-2 text-center text-sm hover:bg-emerald-500/10"
                >
                  <div className="font-medium text-emerald-400">{formatTime(show.start_time)}</div>
                  <div className="text-xs text-slate-400">{formatDay(show.start_time)}</div>
                  <div className="mt-1 text-xs text-slate-300">
                    {formatPrice(show.price_regular)} / {formatPrice(show.price_premium)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}