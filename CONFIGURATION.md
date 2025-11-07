# Projection Model Configuration Guide

This document explains how to adjust the aggressiveness of the election projection model.

## Configuration Location

All configuration parameters are at the top of `/races/projection-engine.js` in the `PROJECTION_CONFIG` object.

## Parameters Explained

### 1. CERTAINTY_THRESHOLD_FOR_CALL
- **Default:** `97.0`
- **Range:** 95.0 - 99.5
- **What it does:** Minimum certainty percentage required to call a race
- **Lower = More Aggressive:** Setting to 95.0 means races get called at 95% certainty instead of 97%
- **Higher = More Conservative:** Setting to 99.0 means only call with 99%+ certainty

**Recommended values:**
- Very Aggressive: `95.0`
- Aggressive: `96.5`
- Moderate (default): `97.0`
- Conservative: `98.5`
- Very Conservative: `99.0`

---

### 2. MIN_REPORTING_FOR_CALL
- **Default:** `0.15` (15% of counties reporting)
- **Range:** 0.0 - 0.5
- **What it does:** Minimum percentage of counties that must report before calling
- **Lower = More Aggressive:** Setting to 0.0 allows calling with any data
- **Higher = More Conservative:** Setting to 0.30 requires 30% of counties

**Recommended values:**
- Very Aggressive: `0.05` (5%)
- Aggressive: `0.10` (10%)
- Moderate (default): `0.15` (15%)
- Conservative: `0.25` (25%)
- Very Conservative: `0.40` (40%)

---

### 3. IMPOSSIBILITY_BUFFER
- **Default:** `0.01` (1% buffer)
- **Range:** 0.0 - 0.10
- **What it does:** Safety margin before calling based on mathematical impossibility
- **Lower = More Aggressive:** 0.0 calls immediately when trailing candidate cannot mathematically win
- **Higher = More Conservative:** 0.05 requires 5% buffer beyond mathematical impossibility

**How it works:** If remaining votes (even if 100% for trailing candidate) cannot overcome the lead + buffer, race is called.

**Recommended values:**
- Very Aggressive: `0.0`
- Aggressive: `0.005` (0.5%)
- Moderate (default): `0.01` (1%)
- Conservative: `0.03` (3%)
- Very Conservative: `0.05` (5%)

---

### 4. HISTORICAL_CONFIDENCE
- **Default:** `0.85` (85% confidence)
- **Range:** 0.5 - 1.0
- **What it does:** How much to trust historical turnout estimates when calculating remaining votes
- **Lower = More Conservative:** 0.6 means only count 60% of historical turnout estimates
- **Higher = More Aggressive:** 0.95 means trust historical data is very accurate

**Example:** If historical data says 100,000 votes expected from a county, but only 50,000 reported:
- At 0.85: Model estimates 42,500 remaining votes (50,000 × 0.85)
- At 0.95: Model estimates 47,500 remaining votes (50,000 × 0.95)

**Recommended values:**
- Very Aggressive: `0.90`
- Aggressive: `0.87`
- Moderate (default): `0.85`
- Conservative: `0.75`
- Very Conservative: `0.65`

---

### 5. BLOWOUT_MARGIN
- **Default:** `0.10` (10% margin)
- **Range:** 0.05 - 0.20
- **What it does:** Vote margin that triggers instant call when high reporting
- **Lower = More Aggressive:** 0.05 calls races with 5%+ margin
- **Higher = More Conservative:** 0.15 requires 15%+ margin for blowout call

**Works in conjunction with BLOWOUT_REPORTING_THRESHOLD**

**Recommended values:**
- Very Aggressive: `0.05` (5%)
- Aggressive: `0.07` (7%)
- Moderate (default): `0.10` (10%)
- Conservative: `0.15` (15%)
- Very Conservative: `0.20` (20%)

---

### 6. BLOWOUT_REPORTING_THRESHOLD
- **Default:** `0.90` (90% reporting)
- **Range:** 0.75 - 0.98
- **What it does:** Reporting percentage required for blowout margin to trigger
- **Lower = More Aggressive:** 0.75 allows blowout calls with 75% reporting
- **Higher = More Conservative:** 0.95 requires 95% reporting for blowout calls

**Recommended values:**
- Very Aggressive: `0.75` (75%)
- Aggressive: `0.85` (85%)
- Moderate (default): `0.90` (90%)
- Conservative: `0.93` (93%)
- Very Conservative: `0.97` (97%)

---

## Preset Configurations

### CNN-Style (Conservative)
```javascript
CERTAINTY_THRESHOLD_FOR_CALL: 99.0,
MIN_REPORTING_FOR_CALL: 0.25,
IMPOSSIBILITY_BUFFER: 0.03,
HISTORICAL_CONFIDENCE: 0.75,
BLOWOUT_MARGIN: 0.15,
BLOWOUT_REPORTING_THRESHOLD: 0.95
```

### FOX/NBC-Style (Moderate)
```javascript
CERTAINTY_THRESHOLD_FOR_CALL: 97.5,
MIN_REPORTING_FOR_CALL: 0.15,
IMPOSSIBILITY_BUFFER: 0.01,
HISTORICAL_CONFIDENCE: 0.85,
BLOWOUT_MARGIN: 0.10,
BLOWOUT_REPORTING_THRESHOLD: 0.90
```

### Decision Desk-Style (Aggressive)
```javascript
CERTAINTY_THRESHOLD_FOR_CALL: 95.5,
MIN_REPORTING_FOR_CALL: 0.10,
IMPOSSIBILITY_BUFFER: 0.005,
HISTORICAL_CONFIDENCE: 0.90,
BLOWOUT_MARGIN: 0.07,
BLOWOUT_REPORTING_THRESHOLD: 0.80
```

### Very Aggressive
```javascript
CERTAINTY_THRESHOLD_FOR_CALL: 95.0,
MIN_REPORTING_FOR_CALL: 0.05,
IMPOSSIBILITY_BUFFER: 0.0,
HISTORICAL_CONFIDENCE: 0.92,
BLOWOUT_MARGIN: 0.05,
BLOWOUT_REPORTING_THRESHOLD: 0.75
```

---

## How to Change Settings

1. Open `/races/projection-engine.js`
2. Find the `PROJECTION_CONFIG` object (lines 8-33)
3. Change the values
4. Save the file
5. Refresh any race projection pages

**No need to recompile or restart anything - changes take effect immediately!**

---

## Testing Your Configuration

1. Go to any race projection page (e.g., `races/georgia.html`)
2. Enter some vote data with a clear leader
3. Click "Calculate Projection"
4. Observe the certainty percentage and whether race gets called
5. Adjust parameters and test again

---

## Call Reasons

When a race is called, the system may show one of these reasons:

- **"mathematically impossible for trailing candidate"** - Remaining votes cannot change outcome
- **"overwhelming margin with high reporting"** - Blowout scenario triggered
- No special reason = Normal certainty threshold reached

---

## Recommendations

**For realistic election night coverage:**
- Use FOX/NBC-Style (Moderate) preset as starting point
- Monitor a few test races
- Adjust CERTAINTY_THRESHOLD_FOR_CALL by ±1-2 points based on comfort level

**For simulations/testing:**
- Use Aggressive or Very Aggressive presets
- Allows you to see calls with less data

**For maximum accuracy:**
- Use CNN-Style (Conservative) preset
- Only makes calls when extremely confident
