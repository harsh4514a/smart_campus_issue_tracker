"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { authFetch, loadAuth } from "@/lib/client-auth";

export default function StudentReportPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const auth = loadAuth();
    if (!auth) return;
    try {
      await authFetch(
        "/api/issues",
        {
          method: "POST",
          body: JSON.stringify({ title, description, category, location }),
        },
        auth.token
      );
      router.push("/student/issues");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit issue";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Protected allowedRoles={["student"]}>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-semibold mb-4">Report an Issue</h1>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input label="Category" value={category} onChange={setCategory} required />
            <Input label="Title" value={title} onChange={setTitle} required />
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <Input label="Location" value={location} onChange={setLocation} required />
            <button
              type="submit"
              className="rounded bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
            {status && <p className="text-sm text-red-600">{status}</p>}
          </form>
        </div>
      </div>
    </Protected>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        className="mt-1 w-full rounded border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}