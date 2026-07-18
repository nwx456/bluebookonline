/** Client-safe upload limits for the notes exam generator (no server imports). */

export const MAX_NOTES_FILES = 5;
export const MAX_NOTES_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_NOTES_TOTAL_BYTES = MAX_NOTES_FILES * MAX_NOTES_FILE_BYTES;
export const MAX_NOTES_FILE_MB = 50;
export const MAX_NOTES_TOTAL_MB = 250;
export const MAX_NOTES_TEXT_CHARS = 400_000;
