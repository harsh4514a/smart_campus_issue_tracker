import { Suspense } from "react";
import VerifyOtpClient from "./VerifyOtpClient";

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-screen items-center justify-center text-gray-600">
          Loading...
        </div>
      }
    >
      <VerifyOtpClient />
    </Suspense>
  );
}