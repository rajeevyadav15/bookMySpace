export default function FormError({ error }) {
  if (!error) return null;

  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      <p>{error.message}</p>
      {error.errors && error.errors.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {error.errors.map((e, i) => (
            <li key={i}>
              {e.field}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}