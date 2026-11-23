/**
 * @vitest-env happy-dom
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("convex-vue", () => ({
  useConvexQuery: (ref: { _name: string }) => ({
    data: { value: ref._name === "groups.listMine" ? [{ orgId: "org_1", role: "admin", status: "active" }] : [] },
    isPending: { value: false },
  }),
}));

vi.mock("~~/convex/_generated/api", () => ({
  api: {
    functions: {
      groups: {
        listMine: { _name: "groups.listMine" },
      },
    },
  },
  Doc: {} as never,
  Id: {} as never,
}));

const { useGroups } = await import("../../app/composables/useGroups");

describe("useGroups", () => {
  it("returns listMyGroups property", () => {
    const result = useGroups();
    expect(result).toHaveProperty("listMyGroups");
  });

  it("listMyGroups returns a query result with data", () => {
    const { listMyGroups } = useGroups();
    expect(listMyGroups).toHaveProperty("data");
    expect(listMyGroups).toHaveProperty("isPending");
  });

  it("listMyGroups data is an array", () => {
    const { listMyGroups } = useGroups();
    expect(Array.isArray(listMyGroups.data.value)).toBe(true);
  });

  it("listMyGroups data contains group objects with expected shape", () => {
    const { listMyGroups } = useGroups();
    const group = listMyGroups.data.value[0];
    if (group) {
      expect(group).toHaveProperty("orgId");
      expect(group).toHaveProperty("role");
      expect(group).toHaveProperty("status");
    }
  });

  it("listMyGroups isPending is a ref with boolean value", () => {
    const { listMyGroups } = useGroups();
    expect(typeof listMyGroups.isPending.value).toBe("boolean");
  });
});