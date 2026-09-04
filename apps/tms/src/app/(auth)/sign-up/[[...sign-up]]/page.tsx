"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-6">
      <SignUp forceRedirectUrl="/" />
    </div>
  );
}
