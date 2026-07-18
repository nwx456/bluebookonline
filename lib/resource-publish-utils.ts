import type { ModerationStatus } from "@/lib/moderator-auth";

export type ResourcePublishState = {
  visibility: "private" | "public" | string;
  moderationStatus: ModerationStatus | string;
};

export function isResourceLivePublic(resource: ResourcePublishState): boolean {
  return resource.visibility === "public" && resource.moderationStatus === "approved";
}

export function canRequestResourcePublish(resource: ResourcePublishState): boolean {
  if (resource.visibility === "public" && resource.moderationStatus === "pending_review") {
    return false;
  }
  if (isResourceLivePublic(resource)) return false;
  if (resource.moderationStatus === "rejected") return true;
  return resource.visibility === "private" && resource.moderationStatus === "draft";
}

export function canMakeResourcePrivate(resource: ResourcePublishState): boolean {
  return isResourceLivePublic(resource);
}

export function isResourcePendingReview(resource: ResourcePublishState): boolean {
  return resource.visibility === "public" && resource.moderationStatus === "pending_review";
}

export function getResourceModerationStatusLabel(resource: ResourcePublishState): string {
  if (isResourceLivePublic(resource)) return "Published";
  if (isResourcePendingReview(resource)) return "Pending";
  if (resource.moderationStatus === "rejected") return "Rejected";
  return "Private";
}

export function getResourceModerationStatusBadgeClass(resource: ResourcePublishState): string {
  if (isResourceLivePublic(resource)) {
    return "bg-green-100 text-green-800";
  }
  if (isResourcePendingReview(resource)) {
    return "bg-amber-100 text-amber-800";
  }
  if (resource.moderationStatus === "rejected") {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-700";
}

export function getResourcePublishActionLabel(_resource?: ResourcePublishState): string {
  return "Publish";
}
