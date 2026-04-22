"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Zap, ArrowRight, RotateCcw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Uniforms = {
  [key: string]: { value: number[] | number[][] | number; type: string };
};

interface ShaderProps {
  source: string;
  uniforms: Uniforms;
  maxFps?: number;
}

// ─── WebGL Shader ─────────────────────────────────────────────────────────────

const ShaderMaterial = ({ source, uniforms, maxFps = 60 }: { source: string; uniforms: Uniforms; maxFps?: number }) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const material: any = ref.current.material;
    material.uniforms.u_time.value = clock.getElapsedTime();
  });

  const getUniforms = () => {
    const prep: any = {};
    for (const name in uniforms) {
      const u: any = uniforms[name];
      switch (u.type) {
        case "uniform1f": prep[name] = { value: u.value }; break;
        case "uniform1i": prep[name] = { value: u.value }; break;
        case "uniform1fv": prep[name] = { value: u.value }; break;
        case "uniform3fv":
          prep[name] = { value: (u.value as number[][]).map((v) => new THREE.Vector3().fromArray(v)) };
          break;
        default: prep[name] = { value: u.value };
      }
    }
    prep["u_time"] = { value: 0 };
    prep["u_resolution"] = { value: new THREE.Vector2(size.width * 2, size.height * 2) };
    return prep;
  };

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `
      precision mediump float;
      uniform vec2 u_resolution;
      out vec2 fragCoord;
      void main() {
        gl_Position = vec4(position.x, position.y, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }`,
    fragmentShader: source,
    uniforms: getUniforms(),
    glslVersion: THREE.GLSL3,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
  }), [size.width, size.height, source]);

  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader = ({ source, uniforms, maxFps = 60 }: ShaderProps) => (
  <Canvas className="absolute inset-0 h-full w-full">
    <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
  </Canvas>
);

// ─── Dot Matrix Canvas ────────────────────────────────────────────────────────

const DotMatrix = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = "",
  center = ["x", "y"] as ("x" | "y")[],
}) => {
  const uniforms = useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    if (colors.length === 2) colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    else if (colors.length === 3) colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    return {
      u_colors: { value: colorsArray.map((c) => [c[0] / 255, c[1] / 255, c[2] / 255]), type: "uniform3fv" },
      u_opacities: { value: opacities, type: "uniform1fv" },
      u_total_size: { value: totalSize, type: "uniform1f" },
      u_dot_size: { value: dotSize, type: "uniform1f" },
      u_reverse: { value: shader.includes("u_reverse_active") ? 1 : 0, type: "uniform1i" },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;
        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;
        out vec4 fragColor;
        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) { return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x); }
        void main() {
          vec2 st = fragCoord.xy;
          ${center.includes("x") ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));" : ""}
          ${center.includes("y") ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));" : ""}
          float opacity = step(0.0, st.x) * step(0.0, st.y);
          vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));
          float show_offset = random(st2);
          float rand = random(st2 * floor((u_time / 5.0) + show_offset + 5.0));
          opacity *= u_opacities[int(rand * 10.0)];
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));
          vec3 color = u_colors[int(show_offset * 6.0)];
          float asp = 0.5;
          vec2 center_grid = u_resolution / 2.0 / u_total_size;
          float dist = distance(center_grid, st2);
          float max_dist = distance(center_grid, vec2(0.0));
          float t_intro = dist * 0.01 + random(st2) * 0.15;
          float t_outro = (max_dist - dist) * 0.02 + random(st2 + 42.0) * 0.2;
          if (u_reverse == 1) {
            opacity *= 1.0 - step(t_outro, u_time * asp);
            opacity *= clamp(step(t_outro + 0.1, u_time * asp) * 1.25, 1.0, 1.25);
          } else {
            opacity *= step(t_intro, u_time * asp);
            opacity *= clamp((1.0 - step(t_intro + 0.1, u_time * asp)) * 1.25, 1.0, 1.25);
          }
          fragColor = vec4(color, opacity);
          fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

export const CanvasRevealEffect = ({
  animationSpeed = 10,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[0, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => (
  <div className={cn("h-full relative w-full", containerClassName)}>
    <div className="h-full w-full">
      <DotMatrix
        colors={colors}
        dotSize={dotSize ?? 3}
        opacities={opacities}
        shader={`${reverse ? "u_reverse_active" : "false"}_; animation_speed_factor_${animationSpeed.toFixed(1)}_;`}
        center={["x", "y"]}
      />
    </div>
    {showGradient && <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />}
  </div>
);

// ─── Sign-In Page ─────────────────────────────────────────────────────────────

interface SignInPageProps {
  className?: string;
  onSuccess?: (token: string, user: any) => void;
}

export const SignInPage = ({ className, onSuccess }: SignInPageProps) => {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code" | "success">("email");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reverseCanvas, setReverseCanvas] = useState(false);
  const [initialCanvas, setInitialCanvas] = useState(true);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "code") setTimeout(() => codeRefs.current[0]?.focus(), 500);
  }, [step]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to send code");
      setStep("code");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value.replace(/\D/, "");
    setCode(newCode);
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
    if (index === 5 && value) {
      const full = [...newCode];
      if (full.every((d) => d !== "")) handleVerify(full.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) codeRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (fullCode?: string) => {
    const otpCode = fullCode || code.join("");
    if (otpCode.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otpCode }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Invalid code");
      const data = await res.json();

      // Trigger reverse animation
      setReverseCanvas(true);
      setTimeout(() => setInitialCanvas(false), 50);
      setTimeout(() => {
        setStep("success");
        localStorage.setItem("ear_labs_token", data.token);
        localStorage.setItem("ear_labs_user", JSON.stringify(data.user));
        // Set cookie for middleware route protection
        document.cookie = `ear_labs_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`;
        setTimeout(() => onSuccess?.(data.token, data.user), 1200);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setCode(["", "", "", "", "", ""]);
    setError("");
    setReverseCanvas(false);
    setInitialCanvas(true);
  };

  return (
    <div className={cn("flex w-full flex-col min-h-screen bg-black relative overflow-hidden", className)}>
      {/* Canvas background */}
      <div className="absolute inset-0 z-0">
        {initialCanvas && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={3}
              containerClassName="bg-black"
              colors={[[79, 110, 247], [74, 222, 128]]}
              dotSize={5}
              reverse={false}
            />
          </div>
        )}
        {reverseCanvas && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={4}
              containerClassName="bg-black"
              colors={[[79, 110, 247], [74, 222, 128]]}
              dotSize={5}
              reverse={true}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.85)_0%,_transparent_70%)]" />
        <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-1/4 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Navbar */}
      <header className="relative z-20 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">EAR Labs Scraper</span>
            <span className="block text-[10px] text-slate-500 leading-none tracking-widest uppercase">powered by WeOps</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Need help?</span>
          <a href="mailto:support@weops.co" className="text-brand-400 hover:text-brand-300 transition-colors">
            support@weops.co
          </a>
        </div>
      </header>

      {/* Main */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">

            {/* Step 1 — Email */}
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-7 text-center"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                      <Zap size={24} className="text-brand-400" />
                    </div>
                  </div>
                  <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
                    Welcome back
                  </h1>
                  <p className="text-lg text-white/50 font-light">Sign in to EAR Labs Scraper</p>
                </div>

                <div className="space-y-3">
                  <button onClick={() => window.location.href = "http://localhost:8000/auth/google"} className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm transition-all">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-white/30 text-xs">or continue with email</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-3">
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 px-5 text-white text-sm placeholder-white/30 text-center focus:outline-none focus:border-brand-500/50 focus:bg-white/8 transition-all"
                        required
                        disabled={loading}
                      />
                      <button
                        type="submit"
                        disabled={loading || !email.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center transition-all disabled:opacity-50"
                      >
                        <ArrowRight size={15} className="text-white" />
                      </button>
                    </div>
                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                  </form>
                </div>

                <p className="text-xs text-white/25 leading-relaxed">
                  By signing in you agree to the WeOps Terms of Service and Privacy Policy.
                  EAR Labs Scraper is for authorized use only.
                </p>
              </motion.div>
            )}

            {/* Step 2 — OTP Code */}
            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-7 text-center"
              >
                <div className="space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                      <span className="text-2xl">✉️</span>
                    </div>
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-white">Check your email</h1>
                  <p className="text-base text-white/50">
                    We sent a 6-digit code to<br />
                    <span className="text-brand-400">{email}</span>
                  </p>
                </div>

                {/* OTP inputs */}
                <div className="relative rounded-2xl py-4 px-5 border border-white/10 bg-white/3">
                  <div className="flex items-center justify-center gap-1">
                    {code.map((digit, i) => (
                      <div key={i} className="flex items-center">
                        <div className="relative">
                          <input
                            ref={(el) => { codeRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleCodeChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            className="w-9 text-center text-xl bg-transparent text-white border-none focus:outline-none"
                            style={{ caretColor: "transparent" }}
                            disabled={loading}
                          />
                          {!digit && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-xl text-white/20">○</span>
                            </div>
                          )}
                        </div>
                        {i < 5 && <span className="text-white/15 text-lg mx-0.5">|</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">
                    {error}
                  </motion.p>
                )}

                <button
                  onClick={() => handleEmailSubmit({ preventDefault: () => {} } as any)}
                  className="flex items-center gap-1.5 mx-auto text-white/40 hover:text-white/60 text-sm transition-colors"
                >
                  <RotateCcw size={12} />
                  Resend code
                </button>

                <div className="flex gap-3">
                  <motion.button
                    onClick={handleBack}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 px-6 py-3 text-sm transition-all w-[35%]"
                  >
                    Back
                  </motion.button>
                  <motion.button
                    onClick={() => handleVerify()}
                    disabled={!code.every((d) => d !== "") || loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex-1 rounded-full font-medium py-3 text-sm transition-all",
                      code.every((d) => d !== "") && !loading
                        ? "bg-brand-500 hover:bg-brand-600 text-white"
                        : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                    )}
                  >
                    {loading ? "Verifying..." : "Verify"}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Step 3 — Success */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
                className="space-y-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4, type: "spring", stiffness: 200 }}
                  className="flex justify-center"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-green-400 flex items-center justify-center shadow-lg shadow-brand-500/40">
                    <svg className="w-10 h-10 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </motion.div>

                <div>
                  <h1 className="text-4xl font-bold text-white">You're in.</h1>
                  <p className="text-white/50 mt-1">Welcome to EAR Labs Scraper</p>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center justify-center gap-2 text-sm text-white/40"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Redirecting to dashboard...
                </motion.div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
