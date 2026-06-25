export function friendlyError(raw: string): string {
  if (raw === "internal_error")
    return "Our server tripped over its own backpack. Give it another shot.";
  if (raw === "validation_failed")
    return "Something looks off with your answers — even the yak raised an eyebrow. Try going back.";
  if (raw.startsWith("HTTP 5"))
    return "Our server is having a moment. The mountains will wait — try again shortly.";
  if (raw.startsWith("HTTP 4"))
    return "Your session got lost somewhere on the trail. Try refreshing the page.";
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("networkerror"))
    return "Looks like you've gone off-grid. Check your connection and try again.";
  return "Something went sideways. The hostel gods are frowning — try again.";
}
