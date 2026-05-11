import type {
  CandidateProfile,
  CustomerProfileCacheResult,
  Channel,
} from "../types.js";

type ProfileLoader = (input: {
  tenantId: string;
  channel: Channel;
  externalUserId: string;
}) => Promise<CandidateProfile> | CandidateProfile;

export class CustomerProfileCache {
  private readonly profiles = new Map<string, CandidateProfile>();

  async get(input: {
    tenantId: string;
    channel: Channel;
    externalUserId: string;
    forceReload: boolean;
    useCache: boolean;
    cacheVersion?: string | number;
    loader: ProfileLoader;
  }): Promise<CustomerProfileCacheResult> {
    const key = profileKey(input);

    if (!input.forceReload && input.useCache) {
      const cached = this.profiles.get(key);
      if (cached) {
        return { status: "hit", profile: cached };
      }
    }

    const profile = await input.loader(input);

    if (input.useCache && !input.forceReload) {
      this.profiles.set(key, profile);
      return { status: "miss", profile };
    }

    if (input.useCache && input.forceReload) {
      this.profiles.set(key, profile);
    }

    return { status: input.forceReload || !input.useCache ? "bypass" : "miss", profile };
  }

  clear() {
    this.profiles.clear();
  }
}

function profileKey(input: {
  tenantId: string;
  channel: Channel;
  externalUserId: string;
  cacheVersion?: string | number;
}) {
  return `${input.tenantId}:${input.channel}:${input.externalUserId}:${input.cacheVersion ?? "default"}`;
}
