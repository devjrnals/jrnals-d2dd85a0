export const PREMIUM_PANEL_OPEN_EVENT = "jrnals:open-premium";

export function openPremiumPanel() {
  window.dispatchEvent(new CustomEvent(PREMIUM_PANEL_OPEN_EVENT));
}


