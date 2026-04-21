import { useState } from "react";

export function useVibrate() {
  const [active, setActive] = useState(false);
  function trigger() {
    setActive(true);
    setTimeout(() => setActive(false), 400);
  }
  return { className: active ? "btn-vibrate" : "", trigger };
}

export function useConfirmPop() {
  const [active, setActive] = useState(false);
  function trigger() {
    setActive(true);
    setTimeout(() => setActive(false), 300);
  }
  return { className: active ? "btn-pop" : "", trigger };
}
