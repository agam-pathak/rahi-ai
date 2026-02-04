"use client";

export default function AnimatedBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-900/25 via-black to-purple-900/25" />

      {/* Luxury texture */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "url('/texture-dark.png')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      />

      {/* Soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.7)_100%)]" />

    </div>
  );
}
