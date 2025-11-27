#!/usr/bin/env python3
"""
Analyze US House election data (2020-2024) to calculate statewide partisan trends
and apply them to Senate race county-level projections.
"""

import csv
from collections import defaultdict
import json

# Parse House data
def analyze_house_data(filepath):
    """
    Calculate statewide Dem share for each year and state from House races.
    Returns: dict[state][year] = {'demShare': float, 'totalVotes': int}
    """
    results = defaultdict(lambda: defaultdict(lambda: {'dem': 0, 'rep': 0, 'total': 0}))

    with open(filepath, 'r') as f:
        reader = csv.reader(f, delimiter=',')  # Changed from '\t' to ','
        for row in reader:
            if len(row) < 20:
                continue

            year = row[0]
            state = row[1]
            district = row[7]
            stage = row[8]
            special = row[10]
            party = row[12]
            writein = row[13]
            candidatevotes = row[15]

            # Only include general elections, non-special, non-writein
            if stage != 'GEN' or special == 'TRUE' or writein == 'TRUE':
                continue

            try:
                votes = int(candidatevotes)
            except:
                continue

            # Aggregate by state/year
            results[state][year]['total'] += votes
            if party == 'DEMOCRAT':
                results[state][year]['dem'] += votes
            elif party == 'REPUBLICAN':
                results[state][year]['rep'] += votes

    # Calculate Dem share
    trends = {}
    for state in results:
        trends[state] = {}
        for year in results[state]:
            dem = results[state][year]['dem']
            rep = results[state][year]['rep']
            total = dem + rep
            if total > 0:
                trends[state][year] = {
                    'demShare': dem / total,
                    'demVotes': dem,
                    'repVotes': rep,
                    'totalVotes': results[state][year]['total']
                }

    return trends

# Main analysis
trends = analyze_house_data('/home/user/2026-elections/2020-2024-house.tab')

# Print key races
key_states = ['GEORGIA', 'MICHIGAN', 'NORTH CAROLINA', 'OHIO', 'TEXAS', 'VIRGINIA',
              'ALASKA', 'IOWA', 'KANSAS', 'MAINE', 'NEBRASKA', 'NEW HAMPSHIRE']

print("US HOUSE PARTISAN TRENDS (2020-2024)")
print("=" * 80)
for state in sorted(key_states):
    if state not in trends:
        print(f"\n{state}: NO DATA")
        continue

    print(f"\n{state}:")
    years = sorted(trends[state].keys())
    for year in years:
        data = trends[state][year]
        demPct = data['demShare'] * 100
        repPct = (1 - data['demShare']) * 100
        print(f"  {year}: Dem {demPct:.2f}% | Rep {repPct:.2f}% ({data['totalVotes']:,} total votes)")

    # Calculate trend
    if len(years) >= 2:
        first_year = min(years)
        last_year = max(years)
        change = (trends[state][last_year]['demShare'] - trends[state][first_year]['demShare']) * 100
        direction = "MORE Democratic" if change > 0 else "MORE Republican"
        print(f"  TREND ({first_year}→{last_year}): {abs(change):.2f}% {direction}")

# Save to JSON
with open('/home/user/2026-elections/house-trends.json', 'w') as f:
    json.dump(trends, f, indent=2)

print("\n" + "=" * 80)
print(f"Saved detailed trends to house-trends.json")
