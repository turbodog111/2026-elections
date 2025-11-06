// Shared projection system JavaScript
// State-specific data will be loaded from individual files

class RaceProjection {
    constructor(stateName, counties, historicalData) {
        this.stateName = stateName;
        this.counties = counties;
        this.historicalData = historicalData;
        this.voteData = {};

        // Initialize vote data
        counties.forEach(county => {
            this.voteData[county] = { dem: 0, rep: 0 };
        });
    }

    generateCountyInputs() {
        const container = document.getElementById('county-list');
        container.innerHTML = '';

        this.counties.forEach(county => {
            const row = document.createElement('div');
            row.className = 'county-row';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'county-name';
            nameDiv.textContent = county + ' County';

            const demInput = document.createElement('input');
            demInput.type = 'number';
            demInput.className = 'county-input dem-input';
            demInput.placeholder = 'Dem votes';
            demInput.min = '0';
            demInput.id = `dem-${county}`;
            demInput.oninput = () => this.updateVoteTotals();

            const repInput = document.createElement('input');
            repInput.type = 'number';
            repInput.className = 'county-input rep-input';
            repInput.placeholder = 'Rep votes';
            repInput.min = '0';
            repInput.id = `rep-${county}`;
            repInput.oninput = () => this.updateVoteTotals();

            row.appendChild(nameDiv);
            row.appendChild(demInput);
            row.appendChild(repInput);

            container.appendChild(row);
        });
    }

    updateVoteTotals() {
        let totalDem = 0;
        let totalRep = 0;
        let countiesReporting = 0;

        this.counties.forEach(county => {
            const demInput = document.getElementById(`dem-${county}`);
            const repInput = document.getElementById(`rep-${county}`);

            const demVotes = parseInt(demInput.value) || 0;
            const repVotes = parseInt(repInput.value) || 0;

            this.voteData[county] = { dem: demVotes, rep: repVotes };

            totalDem += demVotes;
            totalRep += repVotes;

            if (demVotes > 0 || repVotes > 0) {
                countiesReporting++;
            }
        });

        document.getElementById('dem-votes').textContent = totalDem.toLocaleString();
        document.getElementById('rep-votes').textContent = totalRep.toLocaleString();
        document.getElementById('total-votes').textContent = (totalDem + totalRep).toLocaleString();
        document.getElementById('counties-reporting').textContent = `${countiesReporting} / ${this.counties.length}`;

        const totalVotes = totalDem + totalRep;
        if (totalVotes > 0) {
            const demPct = (totalDem / totalVotes * 100).toFixed(1);
            const repPct = (totalRep / totalVotes * 100).toFixed(1);
            document.getElementById('dem-bar').style.width = demPct + '%';
            document.getElementById('dem-bar').textContent = demPct + '%';
            document.getElementById('rep-bar').style.width = repPct + '%';
            document.getElementById('rep-bar').textContent = repPct + '%';

            const margin = Math.abs(totalDem - totalRep);
            const marginPct = (margin / totalVotes * 100).toFixed(2);
            document.getElementById('vote-margin').textContent = margin.toLocaleString();
            document.getElementById('pct-margin').textContent = marginPct + '%';
        }
    }

    calculateAdvancedProjection() {
        let totalDem = 0;
        let totalRep = 0;
        let reportedCounties = 0;
        let expectedDemOverperformance = 0;
        let expectedRepOverperformance = 0;

        // Calculate current totals and compare to historical benchmarks
        this.counties.forEach(county => {
            const currentDem = this.voteData[county].dem;
            const currentRep = this.voteData[county].rep;

            totalDem += currentDem;
            totalRep += currentRep;

            const currentTotal = currentDem + currentRep;
            if (currentTotal > 0) {
                reportedCounties++;

                // Get historical data for this county
                const historical = this.historicalData[county];
                if (historical) {
                    const currentDemShare = currentDem / currentTotal;
                    const historicalDemShare = historical.demShare || 0.5;
                    const performanceDiff = currentDemShare - historicalDemShare;

                    // Weight by county size
                    const countyWeight = historical.turnout || 10000;

                    if (performanceDiff > 0) {
                        expectedDemOverperformance += performanceDiff * countyWeight;
                    } else {
                        expectedRepOverperformance += Math.abs(performanceDiff) * countyWeight;
                    }
                }
            }
        });

        const totalVotes = totalDem + totalRep;

        if (totalVotes === 0) {
            alert('Please enter some vote data first!');
            return;
        }

        // Calculate current margin
        const demPct = totalDem / totalVotes;
        const currentMargin = Math.abs(demPct - 0.5);

        // Factor in historical performance
        const overperformanceScore = expectedDemOverperformance - expectedRepOverperformance;
        const reportingPercentage = reportedCounties / this.counties.length;

        // Adjust confidence based on % reporting
        let confidenceMultiplier = 1.0;
        if (reportingPercentage < 0.20) {
            confidenceMultiplier = 0.3; // Low confidence with < 20% reporting
        } else if (reportingPercentage < 0.50) {
            confidenceMultiplier = 0.6; // Medium confidence with < 50% reporting
        } else if (reportingPercentage < 0.75) {
            confidenceMultiplier = 0.8; // Good confidence with < 75% reporting
        }

        // Calculate final projection
        const adjustedMargin = currentMargin * confidenceMultiplier;

        const resultDiv = document.getElementById('projection-result');
        const resultText = document.getElementById('projection-text');
        const confidenceText = document.getElementById('projection-confidence');

        // Determine winner
        const demLeading = demPct > 0.5;

        // Determine projection strength
        if (adjustedMargin < 0.015 || reportingPercentage < 0.15) {
            resultDiv.className = 'projection-result tossup';
            resultText.textContent = 'Too Close To Call';
            if (reportingPercentage < 0.15) {
                confidenceText.textContent = 'Not enough data for reliable projection';
            } else {
                confidenceText.textContent = 'Race is within margin of error';
            }
        } else if (demLeading) {
            resultDiv.className = 'projection-result dem';
            if (adjustedMargin > 0.08) {
                resultText.textContent = 'Likely Democrat';
                confidenceText.textContent = `Strong Democratic lead (${(reportingPercentage * 100).toFixed(0)}% reporting)`;
            } else if (adjustedMargin > 0.04) {
                resultText.textContent = 'Lean Democrat';
                confidenceText.textContent = `Moderate Democratic lead (${(reportingPercentage * 100).toFixed(0)}% reporting)`;
            } else {
                resultText.textContent = 'Tilt Democrat';
                confidenceText.textContent = `Slight Democratic lead (${(reportingPercentage * 100).toFixed(0)}% reporting)`;
            }
        } else {
            resultDiv.className = 'projection-result rep';
            if (adjustedMargin > 0.08) {
                resultText.textContent = 'Likely Republican';
                confidenceText.textContent = `Strong Republican lead (${(reportingPercentage * 100).toFixed(0)}% reporting)`;
            } else if (adjustedMargin > 0.04) {
                resultText.textContent = 'Lean Republican';
                confidenceText.textContent = `Moderate Republican lead (${(reportingPercentage * 100).toFixed(0)}% reporting)`;
            } else {
                resultText.textContent = 'Tilt Republican';
                confidenceText.textContent = `Slight Republican lead (${(reportingPercentage * 100).toFixed(0)}% reporting)`;
            }
        }

        // Add historical context to confidence text
        if (Math.abs(overperformanceScore) > 0) {
            const overperformingParty = overperformanceScore > 0 ? 'Democrats' : 'Republicans';
            confidenceText.textContent += ` • ${overperformingParty} outperforming historical benchmarks`;
        }
    }

    resetVotes() {
        this.counties.forEach(county => {
            document.getElementById(`dem-${county}`).value = '';
            document.getElementById(`rep-${county}`).value = '';
            this.voteData[county] = { dem: 0, rep: 0 };
        });

        document.getElementById('dem-votes').textContent = '0';
        document.getElementById('rep-votes').textContent = '0';
        document.getElementById('total-votes').textContent = '0';
        document.getElementById('counties-reporting').textContent = '0 / ' + this.counties.length;
        document.getElementById('vote-margin').textContent = '-';
        document.getElementById('pct-margin').textContent = '-';
        document.getElementById('dem-bar').style.width = '50%';
        document.getElementById('dem-bar').textContent = '50%';
        document.getElementById('rep-bar').style.width = '50%';
        document.getElementById('rep-bar').textContent = '50%';

        const resultDiv = document.getElementById('projection-result');
        resultDiv.className = 'projection-result tossup';
        document.getElementById('projection-text').textContent = 'Too Close To Call';
        document.getElementById('projection-confidence').textContent = 'Enter vote data to see projection';
    }

    initialize() {
        this.generateCountyInputs();
    }
}
