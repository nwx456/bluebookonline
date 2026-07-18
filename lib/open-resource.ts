export type ResourceDownloadResponse = {
  type?: "file" | "link";
  url?: string;
  fileName?: string;
  error?: string;
};

export async function fetchResourceDownload(
  resourceId: string,
  authHeader: HeadersInit
): Promise<ResourceDownloadResponse> {
  const res = await fetch(`/api/resources/${resourceId}/download`, {
    headers: authHeader,
  });
  const data = (await res.json()) as ResourceDownloadResponse;
  if (!res.ok) {
    throw new Error(data.error ?? "Could not access resource.");
  }
  return data;
}

export async function viewResource(
  resourceId: string,
  authHeader: HeadersInit,
  externalUrl?: string | null
): Promise<void> {
  if (externalUrl) {
    window.open(externalUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const data = await fetchResourceDownload(resourceId, authHeader);
  if (data.url) {
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
}

export async function downloadResourceFile(
  resourceId: string,
  authHeader: HeadersInit,
  fileName?: string | null
): Promise<void> {
  const data = await fetchResourceDownload(resourceId, authHeader);
  if (!data.url) return;

  const anchor = document.createElement("a");
  anchor.href = data.url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  const downloadName = fileName ?? data.fileName;
  if (downloadName) {
    anchor.download = downloadName;
  }
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function openResourceLink(externalUrl: string): Promise<void> {
  window.open(externalUrl, "_blank", "noopener,noreferrer");
}
