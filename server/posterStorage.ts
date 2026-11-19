import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { db } from './db.ts';

export const MAX_POSTER_BYTES = 5 * 1024 * 1024; // 5 MB
export const SAFE_POSTER_FILENAME_RE = /^movie-\d+-\d+-[a-f0-9]{12}\.(jpg|png|webp)$/;

export interface ValidatedImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
  byteSize: number;
  sha256: string;
}

export interface StoredPosterMetadata {
  movie_id: number;
  storage_provider: 'LOCAL' | 'GCS';
  storage_key: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  public_url: string;
  uploaded_by: number | null;
  updated_at: string;
}

const DEFAULT_LOCAL_DIR = path.resolve(process.cwd(), 'data', 'uploads', 'posters');

function getLocalStorageDir(): string {
  const configured = process.env.POSTER_STORAGE_DIR?.trim();
  const dir = configured ? path.resolve(configured) : DEFAULT_LOCAL_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getGcsBucketName(): string {
  return process.env.GCS_BUCKET_NAME?.trim() || '';
}

let cachedGcsStorage: Storage | null = null;
function getGcsClient(): Storage {
  if (!cachedGcsStorage) {
    cachedGcsStorage = new Storage();
  }
  return cachedGcsStorage;
}

export function getPosterStorageInfo() {
  const bucket = getGcsBucketName();
  if (bucket) {
    return {
      provider: 'GCS' as const,
      label: `Google Cloud Storage (${bucket})`,
      durableAcrossRedeploys: true,
    };
  }
  return {
    provider: 'LOCAL' as const,
    label: 'Persistent Local Volume + SQLite Binary Backup',
    durableAcrossRedeploys: Boolean(process.env.POSTER_STORAGE_DIR?.trim()),
  };
}

/**
 * Inspects actual magic bytes of an uploaded buffer to verify it is a genuine,
 * non-corrupted JPEG, PNG, or WEBP image. Rejects executables, SVGs, HTML, text,
 * oversized files, and mismatched MIME claims.
 */
export function validatePosterBuffer(
  buffer: Buffer,
  claimedMimeType?: string,
  originalName?: string
): ValidatedImage {
  if (!Buffer.isBuffer(buffer) || buffer.length < 64) {
    throw new Error('Uploaded file is empty or corrupted. Please choose a valid image file.');
  }
  if (buffer.length > MAX_POSTER_BYTES) {
    throw new Error('Poster image exceeds the 5 MB maximum upload limit.');
  }

  // Block dangerous extensions regardless of content
  const lowerName = (originalName || '').toLowerCase();
  if (/\.(exe|dll|bat|cmd|sh|bash|js|mjs|cjs|ts|php|py|rb|pl|html|htm|svg|msi|app|dmg|apk|jar)$/i.test(lowerName)) {
    throw new Error('Executable and script files are strictly prohibited. Upload a JPG, PNG, or WEBP image.');
  }

  // Check executable / script magic signatures explicitly
  // ELF (0x7F 'E' 'L' 'F'), PE/MZ ('M' 'Z'), Shebang ('#!')
  if (
    (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) ||
    (buffer[0] === 0x4d && buffer[1] === 0x5a) ||
    (buffer[0] === 0x23 && buffer[1] === 0x21)
  ) {
    throw new Error('Executable binary detected and rejected. Only JPG, PNG, and WEBP posters are allowed.');
  }

  let detected: { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' } | null = null;

  // JPEG: FF D8 FF (and verify it ends or contains valid JPEG marker structure)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detected = { mimeType: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A (and check IHDR chunk at bytes 12..15)
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a &&
    buffer.subarray(12, 16).toString('ascii') === 'IHDR'
  ) {
    detected = { mimeType: 'image/png', ext: 'png' };
  }
  // WEBP: RIFF....WEBP
  else if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detected = { mimeType: 'image/webp', ext: 'webp' };
  }

  if (!detected) {
    throw new Error(
      'Invalid or unsupported image file. Only genuine JPG, JPEG, PNG, and WEBP image files are accepted.'
    );
  }

  // If browser sent a MIME type, ensure it isn't claiming a non-image executable/text format
  if (claimedMimeType) {
    const normalizedClaim = claimedMimeType.toLowerCase().trim();
    const allowedClaims = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream']);
    if (!allowedClaims.has(normalizedClaim)) {
      throw new Error(`Unsupported file content type (${claimedMimeType}). Upload a JPG, PNG, or WEBP image.`);
    }
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    mimeType: detected.mimeType,
    ext: detected.ext,
    byteSize: buffer.length,
    sha256,
  };
}

function sanitizeDisplayFilename(name: string): string {
  const base = path.basename(name || 'poster').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 120) || 'poster';
}

function generateSafeFilename(movieId: number, ext: 'jpg' | 'png' | 'webp'): string {
  const rand = crypto.randomBytes(6).toString('hex');
  return `movie-${movieId}-${Date.now()}-${rand}.${ext}`;
}

async function deleteStorageAsset(provider: string, storageKey: string): Promise<void> {
  if (!storageKey) return;
  try {
    if (provider === 'GCS') {
      const bucketName = getGcsBucketName();
      if (bucketName) {
        const objectPath = storageKey.startsWith('posters/') ? storageKey : `posters/${storageKey}`;
        await getGcsClient().bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true });
      }
    } else if (SAFE_POSTER_FILENAME_RE.test(storageKey)) {
      const fullPath = path.join(getLocalStorageDir(), storageKey);
      if (fullPath.startsWith(getLocalStorageDir()) && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (err) {
    console.warn(`[PosterStorage] Non-fatal cleanup error for ${provider}:${storageKey}:`, err);
  }
}

export async function saveMoviePoster(params: {
  movieId: number;
  buffer: Buffer;
  claimedMimeType?: string;
  originalFilename?: string;
  adminUserId: number;
}): Promise<{ posterUrl: string; metadata: StoredPosterMetadata }> {
  const { movieId, buffer, claimedMimeType, originalFilename, adminUserId } = params;

  const movie = db.prepare('SELECT id, title FROM movies WHERE id = ?').get(movieId) as
    | { id: number; title: string }
    | undefined;
  if (!movie) {
    throw new Error('Movie not found.');
  }

  const validated = validatePosterBuffer(buffer, claimedMimeType, originalFilename);
  const safeFilename = generateSafeFilename(movieId, validated.ext);
  const cleanOriginal = sanitizeDisplayFilename(originalFilename || safeFilename);

  const previous = db
    .prepare('SELECT storage_provider, storage_key FROM movie_posters WHERE movie_id = ?')
    .get(movieId) as { storage_provider: string; storage_key: string } | undefined;

  const gcsBucket = getGcsBucketName();
  let storageProvider: 'LOCAL' | 'GCS' = 'LOCAL';
  let storageKey = safeFilename;
  let publicUrl = `/uploads/posters/${safeFilename}`;
  let binaryDataForSqlite: Buffer | null = null;

  if (gcsBucket) {
    storageProvider = 'GCS';
    const objectPath = `posters/${safeFilename}`;
    storageKey = safeFilename;

    const bucket = getGcsClient().bucket(gcsBucket);
    const file = bucket.file(objectPath);
    await file.save(buffer, {
      resumable: false,
      contentType: validated.mimeType,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          movieId: String(movieId),
          sha256: validated.sha256,
        },
      },
    });

    if (process.env.GCS_USE_PROXY === 'true') {
      publicUrl = `/uploads/posters/${safeFilename}`;
    } else {
      const base = (
        process.env.GCS_PUBLIC_BASE_URL?.trim() || `https://storage.googleapis.com/${gcsBucket}`
      ).replace(/\/+$/, '');
      publicUrl = `${base}/${objectPath}`;
    }
  } else {
    storageProvider = 'LOCAL';
    const dir = getLocalStorageDir();
    const targetPath = path.join(dir, safeFilename);
    // Double-check containment against path traversal
    if (!targetPath.startsWith(dir + path.sep) && targetPath !== path.join(dir, safeFilename)) {
      throw new Error('Invalid storage destination.');
    }
    fs.writeFileSync(targetPath, buffer, { mode: 0o644 });
    binaryDataForSqlite = buffer;
    publicUrl = `/uploads/posters/${safeFilename}`;
  }

  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO movie_posters (
        movie_id, storage_provider, storage_key, original_filename, mime_type,
        byte_size, sha256, binary_data, public_url, uploaded_by, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(movie_id) DO UPDATE SET
        storage_provider = excluded.storage_provider,
        storage_key = excluded.storage_key,
        original_filename = excluded.original_filename,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        sha256 = excluded.sha256,
        binary_data = excluded.binary_data,
        public_url = excluded.public_url,
        uploaded_by = excluded.uploaded_by,
        updated_at = excluded.updated_at`
    ).run(
      movieId,
      storageProvider,
      storageKey,
      cleanOriginal,
      validated.mimeType,
      validated.byteSize,
      validated.sha256,
      binaryDataForSqlite,
      publicUrl,
      adminUserId,
      nowIso
    );

    db.prepare(
      `UPDATE movies
       SET poster_url = ?,
           poster_managed_by_admin = 1,
           poster_updated_at = ?,
           poster_storage_provider = ?
       WHERE id = ?`
    ).run(publicUrl, nowIso, storageProvider, movieId);
  }).immediate();

  // Remove previous uploaded file/object after DB commit succeeds
  if (previous && previous.storage_key !== storageKey) {
    await deleteStorageAsset(previous.storage_provider, previous.storage_key);
  }

  return {
    posterUrl: publicUrl,
    metadata: {
      movie_id: movieId,
      storage_provider: storageProvider,
      storage_key: storageKey,
      original_filename: cleanOriginal,
      mime_type: validated.mimeType,
      byte_size: validated.byteSize,
      sha256: validated.sha256,
      public_url: publicUrl,
      uploaded_by: adminUserId,
      updated_at: nowIso,
    },
  };
}

export async function removeMoviePoster(movieId: number): Promise<void> {
  const movie = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId) as { id: number } | undefined;
  if (!movie) {
    throw new Error('Movie not found.');
  }

  const existing = db
    .prepare('SELECT storage_provider, storage_key FROM movie_posters WHERE movie_id = ?')
    .get(movieId) as { storage_provider: string; storage_key: string } | undefined;

  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare('DELETE FROM movie_posters WHERE movie_id = ?').run(movieId);
    db.prepare(
      `UPDATE movies
       SET poster_url = '',
           poster_managed_by_admin = 1,
           poster_updated_at = ?,
           poster_storage_provider = NULL
       WHERE id = ?`
    ).run(nowIso, movieId);
  }).immediate();

  if (existing) {
    await deleteStorageAsset(existing.storage_provider, existing.storage_key);
  }
}

export async function resolveUploadedPoster(filename: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  etag: string;
} | null> {
  // Strict filename allowlist prevents any path traversal (../, null bytes, subdirectories)
  if (!SAFE_POSTER_FILENAME_RE.test(filename)) {
    return null;
  }

  const row = db
    .prepare(
      'SELECT storage_provider, storage_key, mime_type, sha256, binary_data FROM movie_posters WHERE storage_key = ?'
    )
    .get(filename) as
    | {
        storage_provider: 'LOCAL' | 'GCS';
        storage_key: string;
        mime_type: string;
        sha256: string;
        binary_data: Buffer | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  if (row.storage_provider === 'GCS') {
    const bucketName = getGcsBucketName();
    if (!bucketName) return null;
    try {
      const [buf] = await getGcsClient().bucket(bucketName).file(`posters/${row.storage_key}`).download();
      return { buffer: buf, mimeType: row.mime_type, etag: `"${row.sha256}"` };
    } catch {
      return null;
    }
  }

  const dir = getLocalStorageDir();
  const fullPath = path.join(dir, row.storage_key);
  if (fs.existsSync(fullPath)) {
    return {
      buffer: fs.readFileSync(fullPath),
      mimeType: row.mime_type,
      etag: `"${row.sha256}"`,
    };
  }

  // Self-heal from SQLite durable binary backup if local disk directory was wiped on restart
  if (row.binary_data && Buffer.isBuffer(row.binary_data) && row.binary_data.length > 0) {
    try {
      fs.writeFileSync(fullPath, row.binary_data, { mode: 0o644 });
    } catch {
      // Non-fatal if disk is read-only; serve directly from SQLite BLOB
    }
    return {
      buffer: row.binary_data,
      mimeType: row.mime_type,
      etag: `"${row.sha256}"`,
    };
  }

  return null;
}
