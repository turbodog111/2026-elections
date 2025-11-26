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
        this.storageKey = `election-2026-${stateName.toLowerCase().replace(/\s/g, '-')}`;
        this.storageAvailable = true; // Track if localStorage is working

        // Try to load saved data first
        this.loadFromStorage();

        // Initialize vote data for any missing counties
        counties.forEach(county => {
            if (!this.voteData[county]) {
                this.voteData[county] = { dem: 0, rep: 0 };
            }
        });
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.voteData));
            this.storageAvailable = true;
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
            if (this.storageAvailable) {
                // Only alert once when storage becomes unavailable
                this.storageAvailable = false;
                alert('⚠️ Warning: Cannot save your vote data. You may be in private browsing mode or storage is full. Your data will be lost when you close this tab.');
            }
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.voteData = JSON.parse(saved);
            }
            this.storageAvailable = true;
        } catch (e) {
            console.warn('Could not load from localStorage:', e);
            this.voteData = {};
            this.storageAvailable = false;
        }
    }

    clearStorage() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.warn('Could not clear localStorage:', e);
        }
    }

    generateCountyInputs() {
        const container = document.getElementById('county-list');
        if (!container) {
            console.error('County list container not found!');
            return;
        }

        // Create wrapper for county list for better scrolling
        container.innerHTML = '<div class="county-list-container" id="county-list-wrapper"></div>';
        const wrapper = document.getElementById('county-list-wrapper');

        this.counties.forEach(county => {
            const row = document.createElement('div');
            row.className = 'county-row';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'county-name';

            // Add historical baseline info
            const historical = this.historicalData[county];
            const histDemPct = historical ? (historical.demShare * 100).toFixed(1) : '50.0';
            const histRepPct = historical ? ((1 - historical.demShare) * 100).toFixed(1) : '50.0';

            nameDiv.innerHTML = `
                <div class="county-name-text">${county} County</div>
                <div class="historical-baseline">Historical: D ${histDemPct}% | R ${histRepPct}%</div>
            `;

            // Sanitize county name for use in IDs (replace spaces and periods with single dash)
            const sanitizedCounty = county.replace(/[\s\.]+/g, '-');

            const demInput = document.createElement('input');
            demInput.type = 'number';
            demInput.className = 'county-input dem-input';
            demInput.placeholder = 'Dem votes';
            demInput.min = '0';
            demInput.max = '10000000'; // Max 10 million votes per county
            demInput.step = '1';
            demInput.id = `dem-${sanitizedCounty}`;
            demInput.dataset.county = county;
            demInput.oninput = () => {
                this.updateVoteTotals();
                this.calculateAdvancedProjection();
            };
            // Load saved value
            if (this.voteData[county] && this.voteData[county].dem > 0) {
                demInput.value = this.voteData[county].dem;
            }

            const repInput = document.createElement('input');
            repInput.type = 'number';
            repInput.className = 'county-input rep-input';
            repInput.placeholder = 'Rep votes';
            repInput.min = '0';
            repInput.max = '10000000'; // Max 10 million votes per county
            repInput.step = '1';
            repInput.id = `rep-${sanitizedCounty}`;
            repInput.dataset.county = county;
            repInput.oninput = () => {
                this.updateVoteTotals();
                this.calculateAdvancedProjection();
            };
            // Load saved value
            if (this.voteData[county] && this.voteData[county].rep > 0) {
                repInput.value = this.voteData[county].rep;
            }

            // Add performance indicator
            const performanceDiv = document.createElement('div');
            performanceDiv.className = 'performance-indicator';
            performanceDiv.id = `performance-${sanitizedCounty}`;
            performanceDiv.innerHTML = '<span class="awaiting-data">Awaiting data</span>';

            row.appendChild(nameDiv);
            row.appendChild(demInput);
            row.appendChild(repInput);
            row.appendChild(performanceDiv);

            wrapper.appendChild(row);
        });

        // Update totals with loaded data
        this.updateVoteTotals();
    }

    updateVoteTotals() {
        let totalDem = 0;
        let totalRep = 0;
        let expectedTotalVotes = 0;

        // Calculate expected total from historical data
        this.counties.forEach(county => {
            const historical = this.historicalData[county];
            if (historical && historical.turnout) {
                expectedTotalVotes += historical.turnout;
            }
        });

        // Calculate actual reported votes and update performance indicators
        this.counties.forEach(county => {
            const sanitizedCounty = county.replace(/[\s\.]+/g, '-');
            const demInput = document.getElementById(`dem-${sanitizedCounty}`);
            const repInput = document.getElementById(`rep-${sanitizedCounty}`);
            const performanceDiv = document.getElementById(`performance-${sanitizedCounty}`);

            if (!demInput || !repInput) {
                console.error(`Inputs not found for county: ${county}`);
                return;
            }

            const demVotes = Math.max(0, parseInt(demInput.value) || 0);
            const repVotes = Math.max(0, parseInt(repInput.value) || 0);
            const countyTotal = demVotes + repVotes;

            this.voteData[county] = { dem: demVotes, rep: repVotes };

            totalDem += demVotes;
            totalRep += repVotes;

            // Update county-level performance indicator
            if (performanceDiv && countyTotal > 0) {
                const currentDemShare = demVotes / countyTotal;
                const currentDemPct = (currentDemShare * 100).toFixed(1);
                const historical = this.historicalData[county];

                if (historical && historical.demShare !== undefined) {
                    const historicalDemShare = historical.demShare;
                    const performanceDiff = currentDemShare - historicalDemShare;
                    const performanceDiffPct = (performanceDiff * 100).toFixed(1);

                    let performanceClass = '';
                    let performanceText = '';

                    if (Math.abs(performanceDiff) < 0.02) {
                        // Within 2% of historical - neutral
                        performanceClass = 'neutral';
                        performanceText = `Current: D ${currentDemPct}% <span class="perf-neutral">≈ Historical</span>`;
                    } else if (performanceDiff > 0) {
                        // Democrats overperforming
                        performanceClass = 'dem-over';
                        performanceText = `Current: D ${currentDemPct}% <span class="perf-dem">+${performanceDiffPct}% vs hist</span>`;
                    } else {
                        // Republicans overperforming (Dems underperforming)
                        performanceClass = 'rep-over';
                        performanceText = `Current: D ${currentDemPct}% <span class="perf-rep">${performanceDiffPct}% vs hist</span>`;
                    }

                    performanceDiv.className = `performance-indicator ${performanceClass}`;
                    performanceDiv.innerHTML = performanceText;
                } else {
                    performanceDiv.innerHTML = `Current: D ${currentDemPct}%`;
                }
            } else if (performanceDiv) {
                performanceDiv.className = 'performance-indicator';
                performanceDiv.innerHTML = '<span class="awaiting-data">Awaiting data</span>';
            }
        });

        const totalVotesReported = totalDem + totalRep;
        const remainingVotes = Math.max(0, expectedTotalVotes - totalVotesReported);
        const percentReported = expectedTotalVotes > 0 ? (totalVotesReported / expectedTotalVotes * 100).toFixed(1) : 0;

        // Update displays
        document.getElementById('dem-votes').textContent = totalDem.toLocaleString();
        document.getElementById('rep-votes').textContent = totalRep.toLocaleString();
        document.getElementById('expected-votes').textContent = expectedTotalVotes.toLocaleString();
        document.getElementById('total-votes').textContent = totalVotesReported.toLocaleString();
        document.getElementById('remaining-votes').textContent = remainingVotes.toLocaleString();
        document.getElementById('percent-reported').textContent = percentReported + '%';

        // Update progress bar
        this.updateProgressBar(totalVotesReported, expectedTotalVotes, percentReported);

        if (totalVotesReported > 0) {
            const demPct = (totalDem / totalVotesReported * 100).toFixed(1);
            const repPct = (totalRep / totalVotesReported * 100).toFixed(1);
            document.getElementById('dem-bar').style.width = demPct + '%';
            document.getElementById('dem-bar').textContent = demPct + '%';
            document.getElementById('rep-bar').style.width = repPct + '%';
            document.getElementById('rep-bar').textContent = repPct + '%';

            const margin = Math.abs(totalDem - totalRep);
            const marginPct = (margin / totalVotesReported * 100).toFixed(2);
            document.getElementById('vote-margin').textContent = margin.toLocaleString();
            document.getElementById('pct-margin').textContent = marginPct + '%';
        }

        // Save to localStorage
        this.saveToStorage();
    }

    calculateAdvancedProjection() {
        let totalDem = 0;
        let totalRep = 0;
        let reportedCounties = 0;
        let expectedDemOverperformance = 0;
        let expectedRepOverperformance = 0;
        let weightedPerformanceShift = 0; // Tracks overall performance trend weighted by county size

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

                    // Weight by county size for more accurate statewide projection
                    const countyWeight = historical.turnout || 10000;

                    // Track weighted performance shift
                    weightedPerformanceShift += performanceDiff * countyWeight;

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

        // Calculate expected total votes and remaining votes
        let expectedTotalVotes = 0;
        let reportedVotes = totalDem + totalRep;

        this.counties.forEach(county => {
            const historical = this.historicalData[county];
            if (historical && historical.turnout) {
                expectedTotalVotes += historical.turnout;
            }
        });

        // Calculate VOTE-BASED reporting percentage (not county-based!)
        const reportingPercentage = expectedTotalVotes > 0 ? reportedVotes / expectedTotalVotes : 0;

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

        // PROJECT remaining votes using historical data + observed performance trends
        let projectedFinalDem = totalDem;
        let projectedFinalRep = totalRep;

        // For unreported votes, use historical baseline adjusted by observed performance shift
        this.counties.forEach(county => {
            const currentDem = this.voteData[county].dem || 0;
            const currentRep = this.voteData[county].rep || 0;
            const currentTotal = currentDem + currentRep;

            const historical = this.historicalData[county];
            if (historical && currentTotal === 0) {
                // County hasn't reported yet - project using historical + trend
                const expectedCountyVotes = historical.turnout * PROJECTION_CONFIG.HISTORICAL_CONFIDENCE;
                const historicalDemShare = historical.demShare || 0.5;

                // Adjust historical share by weighted performance shift observed in other counties
                const performanceAdjustment = expectedTotalVotes > 0 ?
                    (weightedPerformanceShift / expectedTotalVotes) : 0;
                const adjustedDemShare = Math.max(0, Math.min(1, historicalDemShare + performanceAdjustment));

                projectedFinalDem += expectedCountyVotes * adjustedDemShare;
                projectedFinalRep += expectedCountyVotes * (1 - adjustedDemShare);
            }
        });

        const projectedDemLeading = projectedFinalDem > projectedFinalRep;
        const projectedTotal = projectedFinalDem + projectedFinalRep;
        const projectedMargin = projectedTotal > 0 ?
            Math.abs(projectedFinalDem - projectedFinalRep) / projectedTotal : 0;

        // Calculate certainty percentage
        // Base certainty on margin, reporting percentage, historical consistency, and projections
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
            // Margin contribution (0-50%) - both current and projected
            const currentMarginComponent = Math.min(currentMargin * 250, 0.35);
            const projectedMarginComponent = Math.min(projectedMargin * 150, 0.15);
            const marginComponent = currentMarginComponent + projectedMarginComponent;

            // Reporting contribution (0-25%)
            const reportingComponent = reportingPercentage * 0.25;

            // Historical consistency contribution (0-20%) - INCREASED from 10%
            const consistencyComponent = Math.min(Math.abs(overperformanceScore) / 80000, 0.20);

            // Projection agreement bonus (0-5%) - if current leader matches projected leader
            const projectionAgreement = (demLeading === projectedDemLeading) ? 0.05 : 0;

            baseCertainty = marginComponent + reportingComponent + consistencyComponent + projectionAgreement;
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

        // Validate critical DOM elements exist
        if (!resultDiv || !resultText || !confidenceText) {
            console.error('Critical projection display elements not found!');
            alert('Error: Projection display is not properly initialized. Please refresh the page.');
            return;
        }

        // Determine winner (demLeading already declared above)
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
            const sanitizedCounty = county.replace(/[\s\.]+/g, '-');
            const demInput = document.getElementById(`dem-${sanitizedCounty}`);
            const repInput = document.getElementById(`rep-${sanitizedCounty}`);

            if (demInput) demInput.value = '';
            if (repInput) repInput.value = '';
            this.voteData[county] = { dem: 0, rep: 0 };
        });

        // Clear localStorage
        this.clearStorage();

        // Calculate expected total for display
        let expectedTotal = 0;
        this.counties.forEach(county => {
            const historical = this.historicalData[county];
            if (historical && historical.turnout) {
                expectedTotal += historical.turnout;
            }
        });

        document.getElementById('dem-votes').textContent = '0';
        document.getElementById('rep-votes').textContent = '0';
        document.getElementById('total-votes').textContent = '0';
        document.getElementById('expected-votes').textContent = expectedTotal.toLocaleString();
        document.getElementById('remaining-votes').textContent = expectedTotal.toLocaleString();
        document.getElementById('percent-reported').textContent = '0%';
        document.getElementById('vote-margin').textContent = '-';
        document.getElementById('pct-margin').textContent = '-';
        document.getElementById('dem-bar').style.width = '50%';
        document.getElementById('dem-bar').textContent = '50%';
        document.getElementById('rep-bar').style.width = '50%';
        document.getElementById('rep-bar').textContent = '50%';

        // Reset progress bar
        this.updateProgressBar(0, expectedTotal, 0);

        const resultDiv = document.getElementById('projection-result');
        resultDiv.className = 'projection-result tossup';
        document.getElementById('projection-text').textContent = 'Too Close To Call';
        document.getElementById('projection-confidence').textContent = 'Enter vote data to see projection';
    }

    createProgressBar() {
        // Find the vote-bar element and insert progress bar after it
        const voteBar = document.querySelector('.vote-bar');
        if (!voteBar) {
            console.warn('Vote bar not found, progress bar not created');
            return;
        }

        // Create progress bar HTML
        const progressHTML = `
            <div class="vote-progress-container" id="vote-progress">
                <div class="vote-progress-header">
                    <span class="vote-progress-label">Votes Reported</span>
                    <span class="vote-progress-percentage" id="progress-percentage">0%</span>
                </div>
                <div class="vote-progress-bar-container">
                    <div class="vote-progress-bar-fill" id="progress-bar-fill" style="width: 0%"></div>
                </div>
                <div class="vote-progress-text">
                    <span id="progress-reported">0 votes</span>
                    <span id="progress-expected">0 expected</span>
                </div>
            </div>
        `;

        voteBar.insertAdjacentHTML('afterend', progressHTML);
    }

    updateProgressBar(reportedVotes, expectedVotes, percentReported) {
        const progressPercentage = document.getElementById('progress-percentage');
        const progressBarFill = document.getElementById('progress-bar-fill');
        const progressReported = document.getElementById('progress-reported');
        const progressExpected = document.getElementById('progress-expected');

        if (progressPercentage) {
            progressPercentage.textContent = percentReported + '%';
        }

        if (progressBarFill) {
            progressBarFill.style.width = percentReported + '%';
        }

        if (progressReported) {
            progressReported.textContent = reportedVotes.toLocaleString() + ' votes';
        }

        if (progressExpected) {
            progressExpected.textContent = expectedVotes.toLocaleString() + ' expected';
        }
    }

    initialize() {
        this.generateCountyInputs();
        this.createProgressBar();
    }
}
