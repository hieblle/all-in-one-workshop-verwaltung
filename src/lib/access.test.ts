import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: limitMock,
          })),
        })),
      })),
    })),
  },
}));

const { AccessDeniedError, assertTrainerAccess, isTeamRolle } = await import(
  "./access"
);

function sessionFor(rolle: "admin" | "team" | "trainer"): Session {
  return {
    user: { id: "1", nutzerId: 1, rolle },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;
}

beforeEach(() => {
  limitMock.mockReset();
});

describe("isTeamRolle", () => {
  it("treats admin and team as team roles, trainer not", () => {
    expect(isTeamRolle("admin")).toBe(true);
    expect(isTeamRolle("team")).toBe(true);
    expect(isTeamRolle("trainer")).toBe(false);
    expect(isTeamRolle(undefined)).toBe(false);
  });
});

describe("assertTrainerAccess", () => {
  it("rejects unauthenticated sessions", async () => {
    await expect(assertTrainerAccess(null, 1)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("allows admin and team without touching the assignment table", async () => {
    await expect(assertTrainerAccess(sessionFor("admin"), 1)).resolves.toBeUndefined();
    await expect(assertTrainerAccess(sessionFor("team"), 1)).resolves.toBeUndefined();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("allows trainers with an assignment for the workshop", async () => {
    limitMock.mockResolvedValueOnce([{ id: 42 }]);
    await expect(
      assertTrainerAccess(sessionFor("trainer"), 1),
    ).resolves.toBeUndefined();
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it("rejects trainers without an assignment", async () => {
    limitMock.mockResolvedValueOnce([]);
    await expect(
      assertTrainerAccess(sessionFor("trainer"), 1),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
});
