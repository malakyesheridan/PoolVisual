import { usePhotoStore } from "../state/photoStore";

export function currentPlaneAreaM2() {
  const { plane } = usePhotoStore.getState();
  return Math.abs(plane.width * plane.height); // meters^2
}

export async function syncQuoteFromPhoto(materialName: string, coverageM2: number) {
  // Stub: POST to your existing quote API or update local state
  try {
    await fetch("/api/quote/from-photo", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ materialName, coverageM2 })
    });
  } catch (error) {
    console.error("Failed to sync quote:", error);
    // For now, just log the data that would be sent
    console.log("Quote data:", { materialName, coverageM2 });
  }
}
