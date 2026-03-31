export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Unauthorized</h1>
        <p className="mt-3 text-sm text-slate-600">
          You do not have permission to access this page.
        </p>
      </section>
    </main>
  );
}
