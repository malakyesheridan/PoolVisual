import { usePhotoStore } from "./photoStore";

export function getPhotoState() {
  const st = usePhotoStore.getState();
  const { enabled, ...rest } = st; // enabled is UI-only
  return rest;
}

export function loadPhotoState(state: any) {
  const set = usePhotoStore.getState().patch;
  set(state);
}
