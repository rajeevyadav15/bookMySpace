import { useEffect, useState } from "react";
import { api } from "../api/client";
import { qs } from "../utils/qs";
import useDebounce from "../hooks/useDebounce";
import MovieCard from "../components/MovieCard";
import { inputCls } from "../components/styles";

const LIMIT = 12;

export default function Home() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const q = useDebounce(search.trim(), 400);

  // New search always starts from page 1
  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api(`/movies${qs({ q, page, limit: LIMIT })}`, { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    // Cancel old request when a new one starts
    return () => controller.abort();
  }, [q, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Now showing</h1>
        <input
          className={`${inputCls} sm:max-w-xs`}
          placeholder="Search movies"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && !data && <p className="text-slate-400">Loading movies...</p>}

      {data && data.items.length === 0 && !error && (
        <p className="text-slate-400">No movies found.</p>
      )}

      {data && data.items.length > 0 && (
        <div
          className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 ${
            loading ? "opacity-60" : ""
          }`}
        >
          {data.items.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <button
            className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}