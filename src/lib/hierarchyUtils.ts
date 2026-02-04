/**
 * Shared hierarchy logic for resolving multi-level BOMs into leaf parts.
 *
 * Used by both bomParser (multi-BOM CSV import) and excelParser (standard import
 * with optional Level column).
 */

export interface HierarchyRow {
  level: number;
  partNumber: string;
  qty: number;
  description: string;
}

export interface ResolvedLeafPart {
  partNumber: string;
  description: string;
  effectiveQty: number;
  assemblyGroup: string;
}

/**
 * Walk a list of hierarchical rows and return only the leaf parts with their
 * effective (multiplied-through) quantities and top-level assembly group.
 *
 * A row is a "leaf" if the next row has level <= current level (i.e. no deeper
 * children follow it).
 *
 * Quantities are multiplied through the parent chain: if a level-2 assembly
 * has qty 2 and its level-3 child has qty 3, the effective leaf qty is 6.
 *
 * Assembly group = level 1 ancestor's part number, or the part's own number
 * when it is at level 0 or 1.
 */
export function resolveHierarchyLeaves(rows: HierarchyRow[]): ResolvedLeafPart[] {
  // assemblyStack[level] = { partNumber, effectiveQty }
  const assemblyStack = new Map<number, { partNumber: string; effectiveQty: number }>();
  const leafParts: ResolvedLeafPart[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nextRow = i + 1 < rows.length ? rows[i + 1] : null;
    const isLeaf = !nextRow || nextRow.level <= row.level;

    // Calculate effective quantity by multiplying through parent chain
    let parentEffectiveQty = 1;
    for (let lvl = row.level - 1; lvl >= 0; lvl--) {
      const ancestor = assemblyStack.get(lvl);
      if (ancestor) {
        parentEffectiveQty = ancestor.effectiveQty;
        break;
      }
    }

    const effectiveQty = row.qty * parentEffectiveQty;

    // Update assembly stack for this level
    assemblyStack.set(row.level, { partNumber: row.partNumber, effectiveQty });

    // Clean up deeper levels from stack (they're no longer in scope)
    for (const [lvl] of assemblyStack) {
      if (lvl > row.level) {
        assemblyStack.delete(lvl);
      }
    }

    // Determine top-level assembly group (level 1 ancestor, or level 0 if flat)
    let assemblyGroup = '';
    for (let lvl = 1; lvl >= 0; lvl--) {
      const ancestor = assemblyStack.get(lvl);
      if (ancestor) {
        assemblyGroup = ancestor.partNumber;
        break;
      }
    }
    // If the current item IS level 0 or 1, it's its own assembly group
    if (row.level <= 1) {
      assemblyGroup = row.partNumber;
    }

    if (isLeaf) {
      // Round fractional quantities up to 1 minimum
      const finalQty = Math.max(1, Math.ceil(effectiveQty));

      leafParts.push({
        partNumber: row.partNumber,
        description: row.description,
        effectiveQty: finalQty,
        assemblyGroup,
      });
    }
  }

  return leafParts;
}
