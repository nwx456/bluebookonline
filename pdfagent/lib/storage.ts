import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.resolve(process.cwd(), "storage", "pdfs");

export async function ensureStorageDir(): Promise<void> {
  await mkdir(ROOT, { recursive: true });
}

export function pdfStoragePath(documentId: string): string {
  return path.join(ROOT, `${documentId}.pdf`);
}

export async function savePdf(documentId: string, buffer: Buffer): Promise<string> {
  await ensureStorageDir();
  const p = pdfStoragePath(documentId);
  await writeFile(p, buffer);
  return p;
}

export async function loadPdf(documentId: string): Promise<Buffer> {
  return readFile(pdfStoragePath(documentId));
}
