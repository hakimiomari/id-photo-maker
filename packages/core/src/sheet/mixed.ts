/**
 * Batch ("family") mode: several people's photos share one print sheet.
 * The tiler still decides the geometry; this module decides who gets which
 * cell. Pure math, unit-tested.
 */

/**
 * Distribute a sheet's cells among members as evenly as possible: everyone
 * gets the fair-share floor, the remainder goes to the earliest members.
 * Returns the member index for every cell, grouped (member 0's cells first) so
 * cutting the sheet yields contiguous blocks per person.
 *
 * @returns array of length `cells`; entry = member index.
 */
export function assignCells(cells: number, members: number): number[] {
  if (!Number.isInteger(cells) || cells <= 0) {
    throw new Error(`assignCells: cells must be a positive integer (${cells})`);
  }
  if (!Number.isInteger(members) || members <= 0) {
    throw new Error(`assignCells: members must be a positive integer (${members})`);
  }
  if (members > cells) {
    throw new Error(
      `assignCells: ${members} people cannot share a ${cells}-photo sheet`,
    );
  }

  const share = Math.floor(cells / members);
  const remainder = cells % members;
  const assignment: number[] = [];
  for (let member = 0; member < members; member++) {
    const count = share + (member < remainder ? 1 : 0);
    for (let i = 0; i < count; i++) assignment.push(member);
  }
  return assignment;
}

/** Photos per member for a given assignment — for the UI ("3 each"). */
export function countsPerMember(assignment: number[], members: number): number[] {
  const counts = new Array<number>(members).fill(0);
  for (const member of assignment) {
    if (member >= 0 && member < members) counts[member] = (counts[member] ?? 0) + 1;
  }
  return counts;
}
