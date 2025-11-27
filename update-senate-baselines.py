#!/usr/bin/env python3
"""
Update Senate race county baselines using US House partisan trends (2020-2024).
Applies 75% of the calculated House trend to each county's demShare.
"""

import json
import re
from pathlib import Path

# State name mapping (HTML filename → House data state name)
STATE_MAPPING = {
    'alaska': 'ALASKA',
    'georgia': 'GEORGIA',
    'iowa': 'IOWA',
    'kansas': 'KANSAS',
    'maine': 'MAINE',
    'michigan': 'MICHIGAN',
    'nebraska': 'NEBRASKA',
    'new-hampshire': 'NEW HAMPSHIRE',
    'north-carolina': 'NORTH CAROLINA',
    'ohio': 'OHIO',
    'texas': 'TEXAS',
    'virginia': 'VIRGINIA'
}

CONSERVATIVE_FACTOR = 0.75  # Apply 75% of calculated trend

def load_trends():
    """Load House trends from JSON file."""
    with open('house-trends.json', 'r') as f:
        trends = json.load(f)

    # Calculate trend adjustments for each state
    adjustments = {}
    for state_file, state_name in STATE_MAPPING.items():
        if state_name in trends:
            years = sorted(trends[state_name].keys())
            if len(years) >= 2:
                first_year = min(years)
                last_year = max(years)
                first_share = trends[state_name][first_year]['demShare']
                last_share = trends[state_name][last_year]['demShare']

                # Calculate raw trend (positive = more Democratic)
                raw_trend = last_share - first_share

                # Apply conservative factor
                adjustment = raw_trend * CONSERVATIVE_FACTOR

                adjustments[state_file] = {
                    'raw_trend': raw_trend,
                    'adjustment': adjustment,
                    'first_year': first_year,
                    'last_year': last_year
                }

    return adjustments

def update_race_file(filepath, adjustment):
    """Update a race HTML file with adjusted demShare values."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the historicalData object
    pattern = r"(const historicalData = \{)(.*?)(\};)"
    match = re.search(pattern, content, re.DOTALL)

    if not match:
        print(f"  ⚠️  Could not find historicalData in {filepath.name}")
        return False

    historical_section = match.group(2)

    # Parse and update each county entry
    # Pattern: 'County Name': { demShare: 0.XX, turnout: XXXXX }
    county_pattern = r"'([^']+)':\s*\{\s*demShare:\s*([\d.]+),\s*turnout:\s*(\d+)\s*\}"

    updated_counties = []
    counties_found = 0

    def replace_county(m):
        nonlocal counties_found
        county_name = m.group(1)
        old_dem_share = float(m.group(2))
        turnout = m.group(3)

        # Apply adjustment
        new_dem_share = old_dem_share + adjustment

        # Clamp to [0, 1]
        new_dem_share = max(0.0, min(1.0, new_dem_share))

        counties_found += 1

        # Format with 4 decimal places for precision
        return f"'{county_name}': {{ demShare: {new_dem_share:.4f}, turnout: {turnout} }}"

    new_historical_section = re.sub(county_pattern, replace_county, historical_section)

    # Replace in content
    new_content = content.replace(match.group(0),
                                   f"{match.group(1)}{new_historical_section}{match.group(3)}")

    # Write back
    with open(filepath, 'w') as f:
        f.write(new_content)

    return counties_found

def main():
    print("=" * 80)
    print("UPDATING SENATE RACE BASELINES WITH HOUSE TRENDS (2020-2024)")
    print("=" * 80)
    print(f"Conservative factor: {CONSERVATIVE_FACTOR * 100:.0f}% of calculated trend\n")

    # Load trends
    adjustments = load_trends()

    # Update each race file
    races_dir = Path('races')

    for state_file, adj_data in sorted(adjustments.items()):
        filepath = races_dir / f"{state_file}.html"

        if not filepath.exists():
            print(f"⚠️  {state_file}.html not found")
            continue

        raw_trend_pct = adj_data['raw_trend'] * 100
        adjustment_pct = adj_data['adjustment'] * 100
        direction = "←" if adj_data['adjustment'] > 0 else "→"
        party = "DEM" if adj_data['adjustment'] > 0 else "REP"

        print(f"{state_file.upper().replace('-', ' ')}:")
        print(f"  Trend ({adj_data['first_year']}→{adj_data['last_year']}): {raw_trend_pct:+.2f}%")
        print(f"  Adjustment (75%): {adjustment_pct:+.4f}% {direction} {party}")

        counties_updated = update_race_file(filepath, adj_data['adjustment'])

        if counties_updated:
            print(f"  ✓ Updated {counties_updated} counties")
        else:
            print(f"  ✗ Failed to update")
        print()

    print("=" * 80)
    print("UPDATE COMPLETE")
    print("=" * 80)
    print("\nNext steps:")
    print("1. Review changes with: git diff races/*.html")
    print("2. Test a few race pages in browser")
    print("3. Commit as Version 1.11")

if __name__ == '__main__':
    main()
