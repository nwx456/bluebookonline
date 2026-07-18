import type { SupabaseClient } from "@supabase/supabase-js";
import { removeAvatarFromStorage } from "@/lib/user-profile";

/**
 * Removes a user and all associated data. Used by account deletion and admin cleanup.
 */
export async function deleteUserAccount(
  supabase: SupabaseClient,
  email: string
): Promise<{ error: string | null }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Email is required." };

  const { data: profileRow } = await supabase
    .from("usertable")
    .select("avatar_storage_path")
    .eq("email", normalized)
    .maybeSingle();

  await removeAvatarFromStorage(
    supabase,
    profileRow?.avatar_storage_path as string | null | undefined
  );

  const { data: uploads } = await supabase
    .from("pdf_uploads")
    .select("id, storage_path")
    .eq("user_email", normalized);

  for (const upload of uploads ?? []) {
    const uploadId = upload.id as string;
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id")
      .eq("upload_id", uploadId);
    const attemptIds = (attempts ?? []).map((a) => a.id as string);
    if (attemptIds.length) {
      await supabase.from("attempt_answers").delete().in("attempt_id", attemptIds);
      await supabase.from("attempts").delete().in("id", attemptIds);
    }
    await supabase.from("questions").delete().eq("upload_id", uploadId);
    if (upload.storage_path) {
      await supabase.storage.from("pdf_uploads").remove([`${uploadId}.pdf`]);
    }
  }

  const { data: userTags } = await supabase
    .from("user_library_tags")
    .select("id")
    .eq("user_email", normalized);
  const userTagIds = (userTags ?? []).map((tag) => tag.id as string);
  if (userTagIds.length) {
    await supabase.from("user_library_taggings").delete().in("tag_id", userTagIds);
  }
  await supabase.from("user_library_tags").delete().eq("user_email", normalized);
  await supabase.from("attempts").delete().eq("user_email", normalized);
  await supabase.from("pdf_uploads").delete().eq("user_email", normalized);
  await supabase.from("user_consents").delete().eq("user_email", normalized);
  await supabase.from("pending_registrations").delete().eq("email", normalized);

  const { error: userTableError } = await supabase.from("usertable").delete().eq("email", normalized);
  if (userTableError) {
    return { error: userTableError.message };
  }

  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === normalized);
  if (authUser?.id) {
    await supabase.auth.admin.deleteUser(authUser.id);
  }

  return { error: null };
}
