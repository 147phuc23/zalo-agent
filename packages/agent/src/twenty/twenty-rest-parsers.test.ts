import { describe, expect, it } from "vitest";
import { extractCoreManyRecords, extractMetadataRows } from "./twenty-rest-parsers.js";

describe("twenty-rest-parsers", () => {
  it("extracts core record arrays from REST shape", () => {
    const payload = {
      data: {
        people: [{ id: "1", name: "A" }],
      },
      totalCount: 1,
    };

    expect(extractCoreManyRecords(payload)).toEqual([{ id: "1", name: "A" }]);
  });

  it("extracts metadata rows from cleaned GraphQL REST wrapper", () => {
    const payload = {
      data: {
        objects: [{ id: "obj-1", nameSingular: "person" }],
      },
    };

    expect(extractMetadataRows(payload)).toEqual([{ id: "obj-1", nameSingular: "person" }]);
  });
});
