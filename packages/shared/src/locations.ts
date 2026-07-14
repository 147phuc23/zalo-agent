export interface CanonicalLocation {
  slug: string;
  englishName: string;
  vietnameseName: string;
  aliases: string[];
}

/**
 * Single source of truth for the recruiting vertical's canonical Vietnamese cities.
 * Lives in @platform/shared (rather than @platform/agent) so @platform/database
 * (which @platform/agent already depends on) can reuse it without a circular dependency.
 */
export const CANONICAL_LOCATIONS: CanonicalLocation[] = [
  {
    slug: "ho-chi-minh-city",
    englishName: "Ho Chi Minh City",
    vietnameseName: "Hồ Chí Minh",
    aliases: ["hcm", "hcmc", "ho chi minh", "hồ chí minh", "saigon", "sai gon", "tp hcm", "tphcm"],
  },
  {
    slug: "ha-noi",
    englishName: "Ha Noi",
    vietnameseName: "Hà Nội",
    aliases: ["hanoi", "ha noi", "hà nội", "hn"],
  },
  {
    slug: "da-nang",
    englishName: "Da Nang",
    vietnameseName: "Đà Nẵng",
    aliases: ["danang", "da nang", "đà nẵng", "dn"],
  },
  {
    slug: "remote",
    englishName: "Remote",
    vietnameseName: "Từ xa",
    aliases: ["remote", "wfh", "work from home"],
  },
];
