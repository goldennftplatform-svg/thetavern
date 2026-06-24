/** Toggle `html.tavern-mobile` for narrow viewports / coarse pointer — matches EzraMOTA shell pattern. */
export function initMobileShellClass(): void {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(max-width: 799.98px), (pointer: coarse)");
  const apply = (): void => {
    document.documentElement.classList.toggle("tavern-mobile", mq.matches);
  };
  apply();
  mq.addEventListener?.("change", apply);

  const ua = navigator.userAgent || "";
  const mtp = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && mtp > 1);
  document.documentElement.classList.toggle("tavern-ios", isIOS);
}
