"use client";

import { useEffect, useState } from "react";

const QUOTE = "“Not all those who wander are lost”";

export function TypewriterQuote() {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(QUOTE.slice(0, i));
      if (i === QUOTE.length) clearInterval(interval);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className="mb-10 text-center text-sm text-zinc-700 italic"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif", minHeight: "1.5rem" }}
    >
      {displayed}
      {displayed.length < QUOTE.length && <span className="animate-pulse">|</span>}
    </p>
  );
}
