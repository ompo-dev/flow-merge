export const RELEASE_CHANNELS = ["stable", "beta", "internal"] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];
export const RELEASE_ROLES = RELEASE_CHANNELS;
export type ReleaseRole = ReleaseChannel;

export interface ReleaseAccessDescriptor {
  level: ReleaseRole;
  allowedChannels: ReleaseChannel[];
}

export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return typeof value === "string" && RELEASE_CHANNELS.includes(value as ReleaseChannel);
}

export function normalizeReleaseChannel(value: unknown): ReleaseChannel {
  return isReleaseChannel(value) ? value : "stable";
}

export function normalizeReleaseChannels(
  value: unknown,
  fallback: readonly ReleaseChannel[] = ["stable"],
): ReleaseChannel[] {
  const candidates = Array.isArray(value) ? value.filter(isReleaseChannel) : [];
  const ordered = RELEASE_CHANNELS.filter((channel) => candidates.includes(channel));
  return ordered.length ? ordered : [...fallback];
}

export function normalizeReleaseRole(value: unknown): ReleaseRole {
  return normalizeReleaseChannel(value);
}

export function getReleaseAccess(role: ReleaseRole | null | undefined): ReleaseAccessDescriptor {
  if (role === "internal") {
    return {
      level: "internal",
      allowedChannels: [...RELEASE_CHANNELS],
    };
  }

  if (role === "beta") {
    return {
      level: "beta",
      allowedChannels: ["stable", "beta"],
    };
  }

  return {
    level: "stable",
    allowedChannels: ["stable"],
  };
}

export function getVisibleReleaseChannels(
  supportedChannels: readonly ReleaseChannel[],
  allowedChannels: readonly ReleaseChannel[],
): ReleaseChannel[] {
  const normalizedSupported = normalizeReleaseChannels(supportedChannels, RELEASE_CHANNELS);
  const normalizedAllowed = normalizeReleaseChannels(allowedChannels, ["stable"]);
  const visible = RELEASE_CHANNELS.filter(
    (channel) => normalizedSupported.includes(channel) && normalizedAllowed.includes(channel),
  );

  return visible.length ? visible : ["stable"];
}

export function clampReleaseChannel(
  value: unknown,
  allowedChannels: readonly ReleaseChannel[],
  supportedChannels: readonly ReleaseChannel[] = RELEASE_CHANNELS,
): ReleaseChannel {
  const visibleChannels = getVisibleReleaseChannels(supportedChannels, allowedChannels);
  const normalized = normalizeReleaseChannel(value);
  return visibleChannels.includes(normalized)
    ? normalized
    : visibleChannels[visibleChannels.length - 1] ?? "stable";
}

export function getEffectiveReleaseAccess(
  actualAccess: ReleaseAccessDescriptor,
  selectedRole: unknown,
): ReleaseAccessDescriptor {
  const effectiveRole = clampReleaseChannel(selectedRole, actualAccess.allowedChannels);
  return getReleaseAccess(effectiveRole);
}
