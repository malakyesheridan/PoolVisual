export async function exportStagePng(stage: any, scale = 1): Promise<Blob> {
  return new Promise((resolve) => {
    const dataURL = stage.toDataURL({ pixelRatio: scale });
    fetch(dataURL).then(r => r.blob()).then(resolve);
  });
}
