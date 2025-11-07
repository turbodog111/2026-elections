// Shared projection system JavaScript
// State-specific data will be loaded from individual files

// ============================================================================
// CONFIGURABLE PROJECTION PARAMETERS
// Adjust these to control how aggressive the model is when calling races
// ============================================================================
const PROJECTION_CONFIG = {
    // Certainty threshold for calling a race (0-100)
    // Lower = more aggressive calls. Recommended range: 95-99.5
    CERTAINTY_THRESHOLD_FOR_CALL: 97.0,

    // Minimum reporting percentage before model can call race (0-1)
    // Lower = more aggressive. Set to 0 to allow calls with any data
    MIN_REPORTING_FOR_CALL: 0.15,

    // Mathematical impossibility buffer (0-1)
    // Lower = more aggressive when votes remaining can't change outcome
    // 0 = call immediately when mathematically impossible
    // 0.05 = require 5% buffer beyond mathematical impossibility
    IMPOSSIBILITY_BUFFER: 0.01,

    // How much to trust historical turnout estimates (0-1)
    // Higher = more aggressive calls based on expected remaining votes
    HISTORICAL_CONFIDENCE: 0.85,

    // Minimum margin for instant call with high reporting (0-1)
    // With 95%+ reporting, this margin triggers immediate call
    BLOWOUT_MARGIN: 0.10,

    // Reporting threshold for blowout detection (0-1)
    BLOWOUT_REPORTING_THRESHOLD: 0.90
};

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

        // Calculate reporting percentage
        const reportingPercentage = reportedCounties / this.counties.length;

        // Calculate expected total votes and remaining votes
        let expectedTotalVotes = 0;
        let reportedVotes = totalDem + totalRep;

        this.counties.forEach(county => {
            const historical = this.historicalData[county];
            if (historical && historical.turnout) {
                expectedTotalVotes += historical.turnout;
            }
        });

        // Estimate remaining votes based on historical data
        const estimatedRemainingVotes = Math.max(0, expectedTotalVotes - reportedVotes) * PROJECTION_CONFIG.HISTORICAL_CONFIDENCE;

        // Mathematical impossibility check
        const currentLeadVotes = Math.abs(totalDem - totalRep);
        const demLeading = totalDem > totalRep;

        // Check if mathematically impossible for trailing candidate to win
        // Even if 100% of remaining votes go to trailing candidate, can they win?
        const canTrailingCandidateWin = estimatedRemainingVotes > (currentLeadVotes + (estimatedRemainingVotes * PROJECTION_CONFIG.IMPOSSIBILITY_BUFFER));
        const mathematicallyImpossible = !canTrailingCandidateWin && reportingPercentage > PROJECTION_CONFIG.MIN_REPORTING_FOR_CALL;

        // Calculate current margin
        const demPct = totalDem / totalVotes;
        const currentMargin = Math.abs(demPct - 0.5);

        // Factor in historical performance
        const overperformanceScore = expectedDemOverperformance - expectedRepOverperformance;

        // Calculate certainty percentage
        // Base certainty on margin, reporting percentage, and consistency
        let baseCertainty = 0;
        let callReason = '';

        // Check for mathematical impossibility FIRST
        if (mathematicallyImpossible) {
            baseCertainty = 0.999;
            callReason = 'mathematically impossible for trailing candidate';
        } else if (reportingPercentage > PROJECTION_CONFIG.BLOWOUT_REPORTING_THRESHOLD && currentMargin > PROJECTION_CONFIG.BLOWOUT_MARGIN) {
            // Blowout scenario
            baseCertainty = 0.995;
            callReason = 'overwhelming margin with high reporting';
        } else {
            // Normal certainty calculation
            // Margin contribution (0-60%)
            const marginComponent = Math.min(currentMargin * 300, 0.60); // 20% margin = 60% certainty

            // Reporting contribution (0-30%)
            const reportingComponent = reportingPercentage * 0.30;

            // Historical consistency contribution (0-10%)
            const consistencyComponent = Math.min(Math.abs(overperformanceScore) / 100000, 0.10);

            baseCertainty = marginComponent + reportingComponent + consistencyComponent;
        }

        // Convert to percentage
        let certaintyPct = baseCertainty * 100;

        // Cap at 99.9% unless we have overwhelming evidence
        if (certaintyPct > 99.9) certaintyPct = 99.9;

        // Determine if race can be called
        const raceCalled = certaintyPct >= PROJECTION_CONFIG.CERTAINTY_THRESHOLD_FOR_CALL &&
                          reportingPercentage >= PROJECTION_CONFIG.MIN_REPORTING_FOR_CALL;

        const resultDiv = document.getElementById('projection-result');
        const resultText = document.getElementById('projection-text');
        const confidenceText = document.getElementById('projection-confidence');

        // Determine winner
        const demLeading = demPct > 0.5;
        const leadingParty = demLeading ? 'Democrat' : 'Republican';

        // Display certainty percentage
        if (raceCalled) {
            // RACE CALLED
            resultDiv.className = demLeading ? 'projection-result dem called' : 'projection-result rep called';
            resultText.innerHTML = `
                <div class="checkmark-container">
                    <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                        <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                </div>
                <div class="call-label">PROJECTED WINNER</div>
                <div class="party-name">${leadingParty}</div>
            `;

            let confidenceMsg = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
            if (callReason) {
                confidenceMsg += ` • ${callReason}`;
            }
            confidenceText.textContent = confidenceMsg;
        } else {
            // Projection only
            const adjustedMargin = currentMargin * Math.min(reportingPercentage * 2, 1.0);

            if (adjustedMargin < 0.015 || reportingPercentage < 0.15) {
                resultDiv.className = 'projection-result tossup';
                resultText.textContent = 'Too Close To Call';
                if (reportingPercentage < 0.15) {
                    confidenceText.textContent = `Not enough data • Certainty: ${certaintyPct.toFixed(1)}%`;
                } else {
                    confidenceText.textContent = `Race within margin of error • Certainty: ${certaintyPct.toFixed(1)}%`;
                }
            } else if (demLeading) {
                resultDiv.className = 'projection-result dem';
                if (adjustedMargin > 0.08) {
                    resultText.textContent = 'Likely Democrat';
                    confidenceText.textContent = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
                } else if (adjustedMargin > 0.04) {
                    resultText.textContent = 'Lean Democrat';
                    confidenceText.textContent = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
                } else {
                    resultText.textContent = 'Tilt Democrat';
                    confidenceText.textContent = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
                }
            } else {
                resultDiv.className = 'projection-result rep';
                if (adjustedMargin > 0.08) {
                    resultText.textContent = 'Likely Republican';
                    confidenceText.textContent = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
                } else if (adjustedMargin > 0.04) {
                    resultText.textContent = 'Lean Republican';
                    confidenceText.textContent = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
                } else {
                    resultText.textContent = 'Tilt Republican';
                    confidenceText.textContent = `Certainty: ${certaintyPct.toFixed(1)}% • ${(reportingPercentage * 100).toFixed(0)}% reporting`;
                }
            }

            // Add historical context
            if (Math.abs(overperformanceScore) > 0) {
                const overperformingParty = overperformanceScore > 0 ? 'Democrats' : 'Republicans';
                confidenceText.textContent += ` • ${overperformingParty} outperforming benchmarks`;
            }
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
