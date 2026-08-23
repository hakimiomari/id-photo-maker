import { describe, expect, it } from "vitest";
import { assignCells, countsPerMember } from "../src/sheet/mixed";

describe("assignCells", () => {
  it("gives everyone the same count when it divides evenly", () => {
    expect(assignCells(6, 2)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(assignCells(6, 3)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it("gives the remainder to the earliest members", () => {
    expect(assignCells(6, 4)).toEqual([0, 0, 1, 1, 2, 3]);
    expect(countsPerMember(assignCells(6, 4), 4)).toEqual([2, 2, 1, 1]);
  });

  it("keeps each member's photos contiguous for easier cutting", () => {
    const assignment = assignCells(9, 3);
    // Once a member's block ends, it never resumes.
    const seen = new Set<number>();
    let previous = -1;
    for (const member of assignment) {
      if (member !== previous) {
        expect(seen.has(member)).toBe(false);
        seen.add(member);
        previous = member;
      }
    }
  });

  it("solo member gets every cell (the non-batch case)", () => {
    expect(assignCells(6, 1)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("covers every cell exactly once", () => {
    for (const [cells, members] of [[6, 2], [9, 4], [24, 5], [2, 2]] as const) {
      const assignment = assignCells(cells, members);
      expect(assignment).toHaveLength(cells);
      const counts = countsPerMember(assignment, members);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(cells);
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
      // Fairness: nobody is more than one photo ahead of anyone else.
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  it("rejects more people than cells", () => {
    expect(() => assignCells(2, 3)).toThrow(/cannot share/);
  });

  it("rejects degenerate inputs", () => {
    expect(() => assignCells(0, 1)).toThrow(/positive/);
    expect(() => assignCells(6, 0)).toThrow(/positive/);
    expect(() => assignCells(1.5 as number, 1)).toThrow(/positive/);
  });
});
