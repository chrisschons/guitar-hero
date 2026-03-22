# Minor Blues Scale – Shape-Based Model (Claude Prompt)

## Core Instruction

The minor blues scale must be treated as **fixed guitar shapes**, not derived dynamically from the minor pentatonic.

While the minor blues scale is related to the minor pentatonic, it is NOT sufficient to "insert a b5" into pentatonic logic.  
This causes incorrect fret alignment and broken patterns across positions.

Instead:

- Each position is a **predefined spatial shape**
- Shapes are **relative (normalized)**
- Shapes may include **negative frets**
- Shapes must be rendered as-is, then transposed

---

## Key Rules

1. **Do NOT derive blues from pentatonic**
2. **Do NOT recalculate positions per string**
3. **Do NOT shift shapes to avoid negative frets**
4. **ALWAYS render full shape exactly as defined**
5. **Intervals define pitch, NOT position**

---

## Scale Definition

```
1, b3, 4, b5, 5, b7
```

---

## Data Model

```
{
  position: number,
  rootString: number,
  shape: [
    {
      string: number,
      notes: [
        { fret: number, interval: string }
      ]
    }
  ]
}
```

---

## Shapes

### Position 1
```
{ string: 6, notes: [ { fret: 0, interval: "1" }, { fret: 3, interval: "b3" } ] }
{ string: 5, notes: [ { fret: 0, interval: "4" }, { fret: 1, interval: "b5" }, { fret: 2, interval: "5" } ] }
{ string: 4, notes: [ { fret: 0, interval: "b7" }, { fret: 2, interval: "1" } ] }
{ string: 3, notes: [ { fret: 0, interval: "b3" }, { fret: 2, interval: "4" } ] }
{ string: 2, notes: [ { fret: 0, interval: "5" }, { fret: 1, interval: "b5" }, { fret: 3, interval: "b7" } ] }
{ string: 1, notes: [ { fret: 0, interval: "1" }, { fret: 3, interval: "b3" } ] }
```

---

### Position 2
```
{ string: 6, notes: [ { fret: 0, interval: "b3" }, { fret: 2, interval: "4" } ] }
{ string: 5, notes: [ { fret: -1, interval: "5" }, { fret: 0, interval: "b7" }, { fret: 1, interval: "1" } ] }
{ string: 4, notes: [ { fret: -1, interval: "b3" }, { fret: 2, interval: "4" } ] }
{ string: 3, notes: [ { fret: -1, interval: "5" }, { fret: 1, interval: "b7" } ] }
{ string: 2, notes: [ { fret: 0, interval: "1" }, { fret: 2, interval: "b3" } ] }
{ string: 1, notes: [ { fret: 0, interval: "b3" }, { fret: 2, interval: "4" } ] }
```

---

### Position 3
```
{ string: 6, notes: [ { fret: 0, interval: "4" }, { fret: 3, interval: "b5" } ] }
{ string: 5, notes: [ { fret: 0, interval: "b7" }, { fret: 2, interval: "1" } ] }
{ string: 4, notes: [ { fret: 0, interval: "b3" }, { fret: 2, interval: "4" }, { fret: 3, interval: "b5" } ] }
{ string: 3, notes: [ { fret: -1, interval: "5" }, { fret: 0, interval: "b7" }, { fret: 2, interval: "1" } ] }
{ string: 2, notes: [ { fret: 0, interval: "b3" }, { fret: 3, interval: "4" } ] }
{ string: 1, notes: [ { fret: 0, interval: "4" }, { fret: 3, interval: "b5" } ] }
```

---

### Position 4
```
{ string: 6, notes: [ { fret: 0, interval: "b5" }, { fret: 2, interval: "5" } ] }
{ string: 5, notes: [ { fret: -1, interval: "1" }, { fret: 0, interval: "b3" }, { fret: 1, interval: "4" } ] }
{ string: 4, notes: [ { fret: -1, interval: "5" }, { fret: 2, interval: "b7" } ] }
{ string: 3, notes: [ { fret: -1, interval: "1" }, { fret: 1, interval: "b3" } ] }
{ string: 2, notes: [ { fret: 0, interval: "4" }, { fret: 2, interval: "5" } ] }
{ string: 1, notes: [ { fret: 0, interval: "b5" }, { fret: 2, interval: "5" } ] }
```

---

### Position 5
```
{ string: 6, notes: [ { fret: 0, interval: "5" }, { fret: 2, interval: "b7" } ] }
{ string: 5, notes: [ { fret: 0, interval: "b3" }, { fret: 2, interval: "4" } ] }
{ string: 4, notes: [ { fret: -1, interval: "5" }, { fret: 0, interval: "b5" }, { fret: 2, interval: "b7" } ] }
{ string: 3, notes: [ { fret: -1, interval: "1" }, { fret: 2, interval: "b3" } ] }
{ string: 2, notes: [ { fret: 0, interval: "4" }, { fret: 3, interval: "b5" } ] }
{ string: 1, notes: [ { fret: 0, interval: "5" }, { fret: 2, interval: "b7" } ] }
```

---

## Final Reminder

These are **visual/motor patterns**, not theoretical derivations.

Correct behavior:
- Load shape
- Anchor root
- Apply offset
- Render directly

Incorrect behavior:
- Rebuilding from intervals per string
- Modifying spacing
- "Fixing" negative frets

The geometry IS the data.
