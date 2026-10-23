export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "development"
  ) {
    const { startDevLiveSocket } = await import("@/lib/live-dev");
    startDevLiveSocket();
  }
}
