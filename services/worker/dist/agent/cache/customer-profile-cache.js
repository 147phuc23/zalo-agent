export class CustomerProfileCache {
    profiles = new Map();
    async get(input) {
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
function profileKey(input) {
    return `${input.tenantId}:${input.channel}:${input.externalUserId}:${input.cacheVersion ?? "default"}`;
}
