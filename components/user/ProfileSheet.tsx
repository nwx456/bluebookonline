"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Loader2, LogOut, Settings, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user/UserAvatar";
import {
  formatMemberSince,
  formatRole,
  ProfileInfoRow,
} from "@/components/user/ProfileInfoRow";

export type UserProfileData = {
  username: string | null;
  email: string;
  role: string;
  countryCode: string | null;
  legalRegion: string | null;
  memberSince: string | null;
  avatarUrl: string | null;
};

export type ProfileSheetProps = {
  user: User;
  displayName: string;
  onSignOut: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  avatarUrl?: string | null;
  onAvatarUrlChange?: (url: string | null) => void;
  showDisplayName?: boolean;
  triggerClassName?: string;
  hideTrigger?: boolean;
};

export function ProfileSheet({
  user,
  displayName,
  onSignOut,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  avatarUrl: externalAvatarUrl,
  onAvatarUrlChange,
  showDisplayName = false,
  triggerClassName,
  hideTrigger = false,
}: ProfileSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileFetchFailedRef = useRef(false);

  const resolvedAvatarUrl = profile?.avatarUrl ?? externalAvatarUrl ?? null;
  const resolvedDisplayName =
    profile?.username?.trim() ||
    displayName ||
    user.email?.split("@")[0] ||
    "Account";

  const loadProfile = useCallback(
    async (token: string, notifyAvatar = false, force = false) => {
      if (profileFetchFailedRef.current && !force) return;

      setLoading(true);
      if (force) setError(null);
      try {
        const res = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          profileFetchFailedRef.current = true;
          setError(typeof data.error === "string" ? data.error : "Could not load profile.");
          return;
        }
        profileFetchFailedRef.current = false;
        setProfile(data as UserProfileData);
        if (notifyAvatar) {
          onAvatarUrlChange?.(data.avatarUrl ?? null);
        }
      } finally {
        setLoading(false);
      }
    },
    [onAvatarUrlChange]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (token) void loadProfile(token, true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);
      if (token) {
        profileFetchFailedRef.current = false;
        void loadProfile(token, true);
      } else {
        profileFetchFailedRef.current = false;
        setProfile(null);
        onAvatarUrlChange?.(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile, onAvatarUrlChange]);

  useEffect(() => {
    if (open && accessToken) {
      void loadProfile(accessToken, true, true);
    }
  }, [open, accessToken, loadProfile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accessToken) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be 2 MB or smaller.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const signRes = await fetch("/api/user/avatar/create-signed-url", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
        }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(typeof signData.error === "string" ? signData.error : "Upload failed.");
        return;
      }

      const uploadRes = await fetch(signData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        setError("Could not upload image.");
        return;
      }

      const confirmRes = await fetch("/api/user/avatar/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storagePath: signData.storagePath }),
      });
      const confirmData = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        setError(typeof confirmData.error === "string" ? confirmData.error : "Could not save avatar.");
        return;
      }

      const newUrl = (confirmData.avatarUrl as string | null) ?? null;
      onAvatarUrlChange?.(newUrl);
      setProfile((prev) => (prev ? { ...prev, avatarUrl: newUrl } : prev));
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!accessToken) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/avatar/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ remove: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not remove photo.");
        return;
      }
      onAvatarUrlChange?.(null);
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            triggerClassName
          )}
          aria-label="Open profile"
        >
          <UserAvatar displayName={resolvedDisplayName} avatarUrl={resolvedAvatarUrl} size="sm" />
          {showDisplayName ? (
            <span
              className="hidden max-w-[7rem] truncate text-sm font-medium text-gray-700 xl:inline"
              title={user.email ?? ""}
            >
              {resolvedDisplayName}
            </span>
          ) : null}
        </button>
      ) : null}

      <SheetContent side="right" className="w-full bg-white sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
          <SheetDescription>Your account information</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4">
          <div className="flex flex-col items-center gap-3 pt-2">
            <UserAvatar
              displayName={resolvedDisplayName}
              avatarUrl={resolvedAvatarUrl}
              size="lg"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || removing || !accessToken}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                Change photo
              </Button>
              {resolvedAvatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading || removing || !accessToken}
                  onClick={() => void handleRemovePhoto()}
                >
                  {removing ? <Loader2 className="animate-spin" /> : null}
                  Remove photo
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void handleFileChange(e)}
            />
          </div>

          {loading && !profile ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {profile ? (
            <dl className="grid gap-4">
              <ProfileInfoRow
                label="Username"
                value={profile.username?.trim() || resolvedDisplayName}
              />
              <ProfileInfoRow label="Email" value={profile.email} />
              <ProfileInfoRow label="Role" value={formatRole(profile.role)} />
              <ProfileInfoRow
                label="Member since"
                value={formatMemberSince(profile.memberSince)}
              />
              <ProfileInfoRow
                label="Country"
                value={profile.countryCode ?? "—"}
              />
              <ProfileInfoRow
                label="Legal region"
                value={profile.legalRegion ?? "—"}
              />
            </dl>
          ) : null}
        </div>

        <SheetFooter className="border-t border-gray-100">
          <Link
            href="/settings/privacy"
            onClick={() => setOpen(false)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Privacy settings
          </Link>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
