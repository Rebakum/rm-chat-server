import { createClient, SupabaseClient } from "@supabase/supabase-js";
import env from "./env";

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY, or SUPABASE_KEY in .env.",
    );
  }

  if (!client) {
    let supabaseUrl: URL;
    try {
      supabaseUrl = new URL(env.SUPABASE_URL);
    } catch {
      throw new Error("SUPABASE_URL must be a valid http(s) URL.");
    }
    if (supabaseUrl.protocol !== "http:" && supabaseUrl.protocol !== "https:") {
      throw new Error("SUPABASE_URL must use http or https.");
    }

    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  }

  return client;
};

interface UploadResult {
  url: string | null;
  error: string | null;
}

interface DeleteResult {
  success: boolean;
  error: string | null;
}

export const uploadPDF = async (fileName: string, fileBuffer: Buffer): Promise<UploadResult> => {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const { error } = await getSupabase().storage
    .from(env.SUPABASE_BUCKET)
    .upload(sanitized, fileBuffer, { upsert: true });

  if (error) return { url: null, error: error.message };

  const { data } = getSupabase().storage.from(env.SUPABASE_BUCKET).getPublicUrl(sanitized);
  return { url: data.publicUrl, error: null };
};

export const deletePDF = async (fileName: string): Promise<DeleteResult> => {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const { error } = await getSupabase().storage.from(env.SUPABASE_BUCKET).remove([sanitized]);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
};
