# US House → Senate Race Integration Plan

## Overview
Integrate US House election data (2020-2024) to improve county-level baselines for 2026 Senate race projections using statewide partisan trend analysis.

## Data Analysis Summary

### Key Findings from House Data (2020→2024 Trends)

| State | 2020 Dem% | 2024 Dem% | Trend | Direction |
|-------|-----------|-----------|-------|-----------|
| **Alaska** | 45.42% | 49.48% | **+4.06%** | ← Democratic |
| **Georgia** | 49.00% | 47.40% | **-1.60%** | Republican → |
| **Iowa** | 47.00% | 43.49% | **-3.52%** | Republican → |
| **Kansas** | 41.80% | 41.25% | **-0.55%** | Republican → |
| **Maine** | 57.95% | 56.13% | **-1.82%** | Republican → |
| **Michigan** | 50.67% | 49.36% | **-1.31%** | Republican → |
| **Nebraska** | 35.78% | 36.38% | **+0.61%** | ← Democratic |
| **New Hampshire** | 53.90% | 53.51% | **-0.38%** | Republican → |
| **North Carolina** | 50.28% | 44.84% | **-5.43%** | Republican → |
| **Ohio** | 42.98% | 43.42% | **+0.44%** | ← Democratic |
| **Texas** | 45.24% | 40.88% | **-4.36%** | Republican → |
| **Virginia** | 52.40% | 51.90% | **-0.50%** | Republican → |

### Major Trends
- **Most Democratic shift**: Alaska (+4.06%)
- **Most Republican shift**: North Carolina (-5.43%)
- **Largest shifts**: NC (-5.43%), TX (-4.36%), AK (+4.06%), IA (-3.52%)

## Implementation Strategy

### Phase 1: Calculate Trend Adjustments
For each state, use the 2020→2024 House trend to adjust county baselines.

**Formula:**
```
adjusted_demShare = current_demShare + (statewide_trend / 100)
```

**Example - Georgia (Fulton County):**
- Current baseline (2022 Senate runoff): 72% Dem
- Georgia House trend: -1.60% (more Republican)
- Adjusted: 72% - 1.60% = **70.40% Dem**

### Phase 2: Conservative Application
Apply 75% of the calculated trend to avoid over-correction:

```
conservative_adjustment = statewide_trend * 0.75
adjusted_demShare = current_demShare + (conservative_adjustment / 100)
```

**Rationale:**
- Senate races have different dynamics than House races
- Avoids over-fitting to recent House data
- Maintains county-specific characteristics while incorporating statewide movement

### Phase 3: Update Turnout Expectations
Use 2024 House turnout as baseline for 2026 Senate turnout:

**For key races with specified turnout:**
- Keep user-provided turnout values (already set in v1.10)

**For other races:**
- Use 2024 House total votes + 5% midterm adjustment
- Formula: `expected_2026_turnout = house_2024_totalvotes * 1.05`

### Phase 4: County-Level Application

**Files to modify:**
- `alaska.html` (+4.06% trend, apply +3.05% conservative)
- `georgia.html` (-1.60% trend, apply -1.20% conservative)
- `iowa.html` (-3.52% trend, apply -2.64% conservative)
- `kansas.html` (-0.55% trend, apply -0.41% conservative)
- `maine.html` (-1.82% trend, apply -1.37% conservative)
- `michigan.html` (-1.31% trend, apply -0.98% conservative)
- `nebraska.html` (+0.61% trend, apply +0.46% conservative)
- `new-hampshire.html` (-0.38% trend, apply -0.29% conservative)
- `north-carolina.html` (-5.43% trend, apply -4.07% conservative)
- `ohio.html` (+0.44% trend, apply +0.33% conservative)
- `texas.html` (-4.36% trend, apply -3.27% conservative)
- `virginia.html` (-0.50% trend, apply -0.38% conservative)

## Example Implementation

### Before (Georgia - Fulton County):
```javascript
'Fulton': { demShare: 0.72, turnout: 420000 }
```

### After:
```javascript
'Fulton': { demShare: 0.708, turnout: 420000 }
//  Calculation: 0.72 + (-0.016 * 0.75) = 0.72 - 0.012 = 0.708
```

## Validation Strategy

1. **Sanity Check:** Ensure no demShare goes below 0 or above 1
2. **Consistency Check:** Verify statewide aggregates match expectations
3. **Test Projection:** Run sample data through updated baselines

## Benefits

1. **More Accurate Baselines:** Incorporates most recent electoral trends (2024)
2. **Data-Driven:** Based on actual election results, not subjective estimates
3. **Conservative Approach:** 75% application prevents over-correction
4. **Maintains Nuance:** County-specific characteristics preserved

## Next Steps

1. Create Python script to generate updated county data
2. Apply to all 12 key race files
3. Test projections with sample vote data
4. Commit as Version 1.11
5. Document changes in commit message

## Notes

- All key races already have correct turnout expectations from v1.10
- Focus is on improving demShare accuracy using House trends
- Non-key races can benefit from House-based turnout estimates
