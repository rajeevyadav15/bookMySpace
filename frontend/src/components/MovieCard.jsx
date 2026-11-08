import { Link } from "react-router-dom";

export default function MovieCard({ movie }) {
  const genres = movie.genres && movie.genres.length ? ` · ${movie.genres.join(", ")}` : "";

  return (
    <Link
      to={`/movies/${movie.id}`}
      className="group block overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-rose-500"
    >
      <div className="aspect-[2/3] bg-gradient-to-br from-slate-800 to-slate-900">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl font-bold text-slate-600">
            {movie.title.charAt(0)}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate font-semibold group-hover:text-rose-400">{movie.title}</h3>
        <p className="mt-1 truncate text-xs text-slate-400">
          {movie.language}
          {genres}
        </p>
      </div>
    </Link>
  );
}