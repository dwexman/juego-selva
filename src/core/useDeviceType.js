export function getDeviceInfo() {
  if (typeof window === "undefined") {
    return { isLarge: false, width: 1280, height: 800 };
  }

  const { width, height } = window.screen;
  const isLarge = width === 1920 && height === 1080;

  return { isLarge, width, height };
}

export default function useDeviceType() {
  return getDeviceInfo();
}
