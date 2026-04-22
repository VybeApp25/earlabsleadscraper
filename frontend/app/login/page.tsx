"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in-flow";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("ear_labs_token", token);
      document.cookie = `ear_labs_token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`;
      router.replace("/");
      return;
    }
    if (localStorage.getItem("ear_labs_token")) router.replace("/");
  }, []);

  const handleSuccess = (token: string, user: any) => {
    router.replace("/");
  };

  return <SignInPage onSuccess={handleSuccess} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
