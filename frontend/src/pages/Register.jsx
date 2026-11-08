import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FormError from "../components/FormError";
import { buttonCls, inputCls } from "../components/styles";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(form.name, form.email, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create account</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormError error={error} />

        <input
          className={inputCls}
          name="name"
          placeholder="Full name"
          autoComplete="name"
          value={form.name}
          onChange={onChange}
          required
        />
        <input
          className={inputCls}
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          required
        />
        <input
          className={inputCls}
          type="password"
          name="password"
          placeholder="Password (min 8 characters)"
          autoComplete="new-password"
          value={form.password}
          onChange={onChange}
          required
        />

        <button className={`${buttonCls} w-full`} disabled={submitting}>
          {submitting ? "Creating..." : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="text-rose-400 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}