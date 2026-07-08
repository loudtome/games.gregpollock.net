/**
 * Statistical Significance Guesser - Game Logic
 * Generates realistic monthly data with various patterns and noise structures
 */

class DataGenerator {
    /**
     * Box-Muller transform for normal distribution
     */
    static randomNormal(mean = 0, stdDev = 1) {
        let u1 = 0, u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /**
     * Generate autocorrelated noise (AR(1) process)
     * This creates "momentum" where consecutive values influence each other
     */
    static generateAutocorrelatedNoise(n, phi = 0.6, sigma = 1.0) {
        const noise = [this.randomNormal(0, sigma)];
        for (let i = 1; i < n; i++) {
            noise.push(phi * noise[i - 1] + this.randomNormal(0, sigma * Math.sqrt(1 - phi * phi)));
        }
        return noise;
    }

    /**
     * Inject outliers into specific positions
     */
    static injectOutliers(data, numOutliers, magnitude) {
        const outlierIndices = new Set();
        while (outlierIndices.size < numOutliers) {
            outlierIndices.add(Math.floor(Math.random() * data.length));
        }

        outlierIndices.forEach(idx => {
            const direction = Math.random() < 0.5 ? 1 : -1;
            data[idx] += direction * magnitude * (0.8 + Math.random() * 0.4);
        });
    }

    /**
     * Create a clustered deviation (several consecutive points deviate together)
     */
    static injectClusteredDeviation(data, startIdx, clusterSize, magnitude) {
        const direction = Math.random() < 0.5 ? 1 : -1;
        for (let i = startIdx; i < Math.min(startIdx + clusterSize, data.length); i++) {
            // Gradually increase then decrease for smooth cluster
            const position = (i - startIdx) / clusterSize;
            const weight = Math.sin(position * Math.PI); // Bell curve weight
            data[i] += direction * magnitude * weight;
        }
    }

    /**
     * Generate dataset based on archetype
     * Each archetype represents a different real-world challenge
     */
    static generateDataset(minMonths = 12, maxMonths = 24) {
        const n = Math.floor(Math.random() * (maxMonths - minMonths + 1)) + minMonths;

        // Choose an archetype
        const archetypes = [
            'cleanTrendWithOutliers',
            'weakConsistentTrend',
            'falseTrendFromOutliers',
            'autocorrelatedNoise',
            'regimeShift',
            'strongTrendWeakSignificance',
            'noisyButSignificant'
        ];

        const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

        // Generate based on archetype
        let result;
        switch (archetype) {
            case 'cleanTrendWithOutliers':
                result = this.generateCleanTrendWithOutliers(n);
                break;
            case 'weakConsistentTrend':
                result = this.generateWeakConsistentTrend(n);
                break;
            case 'falseTrendFromOutliers':
                result = this.generateFalseTrendFromOutliers(n);
                break;
            case 'autocorrelatedNoise':
                result = this.generateAutocorrelatedNoiseData(n);
                break;
            case 'regimeShift':
                result = this.generateRegimeShift(n);
                break;
            case 'strongTrendWeakSignificance':
                result = this.generateStrongTrendWeakSignificance(n);
                break;
            case 'noisyButSignificant':
                result = this.generateNoisyButSignificant(n);
                break;
        }

        result.archetype = archetype;
        return result;
    }

    /**
     * Archetype 1: Clean trend with a few dramatic outliers
     * Challenge: Don't let outliers fool you - underlying trend is real
     */
    static generateCleanTrendWithOutliers(n) {
        const slope = (Math.random() - 0.5) * 3;
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const baseNoise = 2 + Math.random() * 3;

        const data = [];
        for (let i = 0; i < n; i++) {
            const x = i;
            const y = slope * x + intercept + this.randomNormal(0, baseNoise);
            data.push(y);
        }

        // Add 1-3 dramatic outliers
        const numOutliers = 1 + Math.floor(Math.random() * 3);
        this.injectOutliers(data, numOutliers, baseNoise * 4);

        return { data, trueSlope: slope };
    }

    /**
     * Archetype 2: Weak but consistent trend
     * Challenge: Small effect size but steady - is sample size enough?
     */
    static generateWeakConsistentTrend(n) {
        const slope = (Math.random() - 0.5) * 1.5; // Small slope
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const baseNoise = 3 + Math.random() * 3;

        const data = [];
        for (let i = 0; i < n; i++) {
            const x = i;
            const y = slope * x + intercept + this.randomNormal(0, baseNoise);
            data.push(y);
        }

        return { data, trueSlope: slope };
    }

    /**
     * Archetype 3: False trend created by outliers
     * Challenge: Apparent slope is just from extreme values
     */
    static generateFalseTrendFromOutliers(n) {
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const baseNoise = 3 + Math.random() * 2;

        // Generate mostly flat data
        const data = [];
        for (let i = 0; i < n; i++) {
            data.push(intercept + this.randomNormal(0, baseNoise));
        }

        // Add strategic outliers that create false trend
        const direction = Math.random() < 0.5 ? 1 : -1;
        data[0] += direction * -15 * (0.8 + Math.random() * 0.4);
        data[n - 1] += direction * 15 * (0.8 + Math.random() * 0.4);

        // Maybe add one more in the middle to reinforce
        if (Math.random() < 0.6) {
            const midIdx = Math.floor(n / 2);
            data[midIdx] += direction * 5 * (0.8 + Math.random() * 0.4);
        }

        return { data, trueSlope: 0 };
    }

    /**
     * Archetype 4: Autocorrelated noise that looks like trend
     * Challenge: Momentum/inertia creates apparent pattern
     */
    static generateAutocorrelatedNoiseData(n) {
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const phi = 0.5 + Math.random() * 0.3; // High autocorrelation
        const sigma = 4 + Math.random() * 3;

        const noise = this.generateAutocorrelatedNoise(n, phi, sigma);
        const data = noise.map(n => intercept + n);

        return { data, trueSlope: 0 };
    }

    /**
     * Archetype 5: Regime shift - trend changes partway through
     * Challenge: First half follows trend, second half doesn't (or vice versa)
     */
    static generateRegimeShift(n) {
        const slope = (Math.random() - 0.5) * 3;
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const baseNoise = 2 + Math.random() * 3;
        const shiftPoint = Math.floor(n * (0.4 + Math.random() * 0.2)); // Shift at 40-60%

        const data = [];
        for (let i = 0; i < n; i++) {
            const x = i;
            let y;

            if (i < shiftPoint) {
                // First regime: follows trend
                y = slope * x + intercept + this.randomNormal(0, baseNoise);
            } else {
                // Second regime: much more noise or flat
                const shiftNoise = baseNoise * 3;
                const shiftedIntercept = data[shiftPoint - 1];
                y = shiftedIntercept + this.randomNormal(0, shiftNoise);
            }

            data.push(y);
        }

        return { data, trueSlope: 0 }; // Overall not significant due to shift
    }

    /**
     * Archetype 6: Strong trend but small sample size
     * Challenge: Dramatic effect but too few points for confidence
     */
    static generateStrongTrendWeakSignificance(n) {
        // Force small n
        const smallN = Math.min(n, 12 + Math.floor(Math.random() * 3));
        const slope = (Math.random() - 0.5) * 5; // Large slope
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const baseNoise = 5 + Math.random() * 5; // High noise

        const data = [];
        for (let i = 0; i < smallN; i++) {
            const x = i;
            const y = slope * x + intercept + this.randomNormal(0, baseNoise);
            data.push(y);
        }

        return { data, trueSlope: slope };
    }

    /**
     * Archetype 7: Very noisy but actually significant
     * Challenge: Lots of scatter but underlying trend is real
     */
    static generateNoisyButSignificant(n) {
        // Force larger n for statistical power
        const largeN = Math.max(n, 18);
        const slope = (Math.random() - 0.5) * 2.5;
        const intercept = 50 + (Math.random() - 0.5) * 20;
        const baseNoise = 6 + Math.random() * 4; // Very noisy

        // Use autocorrelated noise for realism
        const noise = this.generateAutocorrelatedNoise(largeN, 0.4, baseNoise);

        const data = [];
        for (let i = 0; i < largeN; i++) {
            const x = i;
            const y = slope * x + intercept + noise[i];
            data.push(y);
        }

        // Add a clustered deviation
        const clusterStart = Math.floor(largeN * 0.3);
        this.injectClusteredDeviation(data, clusterStart, Math.floor(largeN * 0.2), baseNoise * 0.8);

        return { data, trueSlope: slope };
    }
}

class StatisticalTests {
    /**
     * Calculate linear regression
     */
    static linearRegression(xValues, yValues) {
        const n = xValues.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        for (let i = 0; i < n; i++) {
            sumX += xValues[i];
            sumY += yValues[i];
            sumXY += xValues[i] * yValues[i];
            sumXX += xValues[i] * xValues[i];
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return { slope, intercept };
    }

    /**
     * Calculate p-value for linear regression
     */
    static calculatePValue(xValues, yValues) {
        const n = xValues.length;
        const regression = this.linearRegression(xValues, yValues);

        // Calculate residuals and standard error
        const meanY = yValues.reduce((sum, y) => sum + y, 0) / n;
        let sse = 0, sst = 0;

        for (let i = 0; i < n; i++) {
            const predicted = regression.slope * xValues[i] + regression.intercept;
            const residual = yValues[i] - predicted;
            sse += residual * residual;
            sst += Math.pow(yValues[i] - meanY, 2);
        }

        // Standard error of the slope
        const mse = sse / (n - 2);
        const sumXSquaredDeviations = xValues.reduce((sum, x, i) => {
            const meanX = xValues.reduce((s, v) => s + v, 0) / n;
            return sum + Math.pow(x - meanX, 2);
        }, 0);

        const se = Math.sqrt(mse / sumXSquaredDeviations);

        // T-statistic
        const t = Math.abs(regression.slope / se);

        // Approximate p-value using t-distribution
        const pValue = this.tTestPValue(t, n - 2);

        return { pValue, regression, tStat: t };
    }

    /**
     * Approximate p-value from t-statistic
     */
    static tTestPValue(t, df) {
        if (df < 1) return 1;

        // Using approximation for t-distribution
        // More accurate than previous version
        const x = df / (df + t * t);

        // Beta function approximation
        let p;
        if (t < 1) {
            p = 0.5 - t * (1 - t * t / (6 * df)) / 2;
        } else {
            p = Math.pow(x, df / 2) / 2;

            // Adjust for very small p-values
            if (t > 3.5) p *= 0.01;
            else if (t > 2.8) p *= 0.05;
            else if (t > 2.1) p *= 0.2;
            else if (t > 1.5) p *= 0.5;
        }

        return Math.max(0.0001, Math.min(1, p * 2)); // Two-tailed, bounded
    }

    /**
     * Get t-critical value for given alpha level and degrees of freedom
     * This is an approximation suitable for confidence intervals
     */
    static tCritical(alpha, df) {
        // For common alpha levels and reasonable df, use approximations
        // These are conservative estimates that work well for visualization

        // Determine which alpha bracket we're in
        let alphaKey;
        if (alpha <= 0.01) {
            alphaKey = 0.01; // 99% confidence
        } else if (alpha <= 0.05) {
            alphaKey = 0.05; // 95% confidence
        } else {
            alphaKey = 0.10; // 90% confidence
        }

        // T-critical values for different df and alpha levels
        // These are two-tailed values
        const tTable = {
            0.01: { // 99% confidence
                30: 2.750,
                20: 2.845,
                10: 3.169,
                5: 4.032,
                0: 5.841
            },
            0.05: { // 95% confidence
                30: 2.042,
                20: 2.086,
                10: 2.228,
                5: 2.571,
                0: 3.182
            },
            0.10: { // 90% confidence
                30: 1.697,
                20: 1.725,
                10: 1.812,
                5: 2.015,
                0: 2.353
            }
        };

        // Find appropriate df bracket
        let dfKey;
        if (df >= 30) dfKey = 30;
        else if (df >= 20) dfKey = 20;
        else if (df >= 10) dfKey = 10;
        else if (df >= 5) dfKey = 5;
        else dfKey = 0;

        return tTable[alphaKey][dfKey];
    }
}

class StatisticalGame {
    constructor() {
        this.attempts = 0;
        this.score = 0;
        this.maxRounds = 10;
        this.currentDataset = null;
        this.chart = null;

        // Settings
        this.settings = {
            confidenceLevel: 95, // 90, 95, or 99
            minMonths: 12,
            maxMonths: 24
        };

        // Score outcomes configuration
        // UPDATE THE IMAGE URLs BELOW WITH YOUR IMGUR LINKS
        this.scoreOutcomes = [
            {
                minScore: 10,
                maxScore: 10,
                imageUrl: 'https://media1.tenor.com/m/ug1DBRF_MjIAAAAC/bill-oreilly-well-do-it-live.gif', // Replace with your URL
                message: 'You did it! No more measurements needed, just eyeball those charts!'
            },
            {
                minScore: 8,
                maxScore: 9,
                imageUrl: 'https://i.makeagif.com/media/12-09-2022/boc_er.gif', // Replace with your URL
                message: 'The force is strong, but not strong enough! Keep guessing and eventually you\'ll be right.'
            },
            {
                minScore: 5,
                maxScore: 7,
                imageUrl: 'https://media1.tenor.com/m/5vo_w_jDfwgAAAAd/calculation-math.gif', // Replace with your URL
                message: 'Not bad, but not that good either! Keep calculating those pvalues– you need them.'
            },
            {
                minScore: 0,
                maxScore: 4,
                imageUrl: 'https://media1.tenor.com/m/g8zxaDebdWYAAAAC/coyote.gif', // Replace with your URL
                message: 'Not great! Thankfully, statistical measurements can correct for your terrible intuition.'
            }
        ];

        this.initChart();
        this.initSettings();
        this.generateNewDataset();
        this.attachEventListeners();
    }

    initChart() {
        const ctx = document.getElementById('myChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Monthly Values',
                    data: [],
                    backgroundColor: 'rgba(30, 58, 95, 0.7)',
                    borderColor: 'rgba(30, 58, 95, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            filter: function(item, chart) {
                                // Only show legend for control limit lines with valid labels
                                return item.text !== 'Monthly Values' && item.text && item.text !== 'undefined';
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (item) => `Value: ${item.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month',
                            font: { size: 14 }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Value',
                            font: { size: 14 }
                        },
                        beginAtZero: false
                    }
                }
            }
        });
    }

    initSettings() {
        this.updateSubtitle();
    }

    updateSubtitle() {
        const subtitle = document.querySelector('.subtitle');
        subtitle.textContent = `Is this monthly trend real or just noise? (${this.settings.confidenceLevel}% confidence level)`;
    }

    getAlphaLevel() {
        // Convert confidence level to alpha (significance threshold)
        return (100 - this.settings.confidenceLevel) / 100;
    }

    generateNewDataset() {
        // Generate dataset with realistic structure using current settings
        const { data, trueSlope, archetype } = DataGenerator.generateDataset(
            this.settings.minMonths,
            this.settings.maxMonths
        );

        const n = data.length;
        const xValues = Array.from({ length: n }, (_, i) => i);

        // Calculate statistics
        const stats = StatisticalTests.calculatePValue(xValues, data);

        // Use settings to determine significance
        const alphaLevel = this.getAlphaLevel();

        this.currentDataset = {
            data,
            n,
            xValues,
            trueSlope,
            archetype,
            isSignificant: stats.pValue < alphaLevel,
            pValue: stats.pValue,
            regression: stats.regression,
            tStat: stats.tStat,
            alphaLevel
        };

        this.updateChart();
        this.updateInfo();
    }

    calculateRegressionConfidenceBand(xValues, yValues, confidenceLevel) {
        // Calculate regression line and confidence bands
        const n = xValues.length;
        const regression = StatisticalTests.linearRegression(xValues, yValues);

        // Calculate necessary statistics
        const meanX = xValues.reduce((sum, x) => sum + x, 0) / n;
        const meanY = yValues.reduce((sum, y) => sum + y, 0) / n;

        // Calculate SSE (sum of squared errors) and SSx (sum of squared deviations of x)
        let sse = 0, ssx = 0;
        for (let i = 0; i < n; i++) {
            const predicted = regression.slope * xValues[i] + regression.intercept;
            const residual = yValues[i] - predicted;
            sse += residual * residual;
            ssx += Math.pow(xValues[i] - meanX, 2);
        }

        // Calculate standard error of regression
        const mse = sse / (n - 2);
        const seRegression = Math.sqrt(mse);

        // Get t-critical value for the confidence level
        const alpha = (100 - confidenceLevel) / 100;
        const tCrit = StatisticalTests.tCritical(alpha, n - 2);

        // Calculate regression line and confidence bands for each x value
        const regressionLine = [];
        const upperBand = [];
        const lowerBand = [];

        for (let i = 0; i < n; i++) {
            const x = xValues[i];
            const yHat = regression.slope * x + regression.intercept;

            // Standard error at this point
            // SE = seRegression × sqrt(1/n + (x - meanX)² / SSx)
            const seAtPoint = seRegression * Math.sqrt(1/n + Math.pow(x - meanX, 2) / ssx);

            // Confidence interval
            const margin = tCrit * seAtPoint;

            regressionLine.push(yHat);
            upperBand.push(yHat + margin);
            lowerBand.push(yHat - margin);
        }

        return {
            regressionLine,
            upperBand,
            lowerBand,
            regression
        };
    }

    updateChart(showRegressionBands = false) {
        const { data, n, xValues } = this.currentDataset;

        // Create month labels
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const labels = Array.from({ length: n }, (_, i) => months[i % 12]);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;

        // Use primary color with slight opacity variation
        const colors = data.map((_, i) => {
            const opacity = 0.6 + (i / n) * 0.3; // Gradual opacity increase
            return `rgba(30, 58, 95, ${opacity})`;
        });
        this.chart.data.datasets[0].backgroundColor = colors;

        // Add regression line and confidence bands if requested
        if (showRegressionBands) {
            const bands = this.calculateRegressionConfidenceBand(
                xValues,
                data,
                this.settings.confidenceLevel
            );

            // Calculate mean Y for null hypothesis line
            const meanY = data.reduce((sum, y) => sum + y, 0) / n;

            // Remove existing regression datasets if any
            this.chart.data.datasets = this.chart.data.datasets.filter(ds => !ds.isRegressionViz);

            // Add null hypothesis line (solid red - what "no trend" looks like)
            this.chart.data.datasets.push({
                label: 'Null Hypothesis (No Trend)',
                data: Array(n).fill(meanY),
                type: 'line',
                borderColor: 'rgba(220, 53, 69, 0.9)',
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                isRegressionViz: true,
                order: 3
            });

            // Add regression line (solid green line)
            this.chart.data.datasets.push({
                label: 'Fitted Regression Line',
                data: bands.regressionLine,
                type: 'line',
                borderColor: 'rgba(40, 167, 69, 0.9)',
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                isRegressionViz: true,
                order: 1
            });

            // Add upper confidence band (dashed gray line)
            this.chart.data.datasets.push({
                label: `${this.settings.confidenceLevel}% Confidence Band`,
                data: bands.upperBand,
                type: 'line',
                borderColor: 'rgba(108, 117, 125, 0.7)',
                borderWidth: 2,
                borderDash: [8, 4],
                pointRadius: 0,
                fill: '+1',
                backgroundColor: 'rgba(108, 117, 125, 0.08)',
                isRegressionViz: true,
                order: 2
            });

            // Add lower confidence band (dashed gray line)
            this.chart.data.datasets.push({
                data: bands.lowerBand,
                type: 'line',
                borderColor: 'rgba(108, 117, 125, 0.7)',
                borderWidth: 2,
                borderDash: [8, 4],
                pointRadius: 0,
                fill: false,
                isRegressionViz: true,
                order: 2
            });
        } else {
            // Remove regression visualization if it exists
            this.chart.data.datasets = this.chart.data.datasets.filter(ds => !ds.isRegressionViz);
        }

        this.chart.update();
    }

    updateInfo() {
        document.getElementById('scoreDisplay').textContent = `${this.score}/${this.attempts}`;
    }

    makeGuess(guessSignificant) {
        const correct = guessSignificant === this.currentDataset.isSignificant;

        this.attempts++;

        if (correct) {
            this.score++;
            this.showFeedback(true);
        } else {
            this.showFeedback(false);
        }

        // Show regression line and confidence bands after guess is made
        this.updateChart(true);

        // Show explanation of how to interpret the visualization
        this.showExplanation();

        this.updateInfo();

        // Animate out guess buttons
        const gameControls = document.getElementById('gameControls');
        const nextContainer = document.getElementById('nextContainer');

        gameControls.classList.add('hiding');

        // Wait for shrink animation to complete, then swap buttons
        setTimeout(() => {
            gameControls.classList.add('hidden');
            gameControls.classList.remove('hiding');

            if (this.attempts < this.maxRounds) {
                nextContainer.classList.remove('hidden');
                nextContainer.classList.add('showing');

                // Remove showing class after animation completes
                setTimeout(() => {
                    nextContainer.classList.remove('showing');
                }, 300);
            } else {
                this.endGame();
            }
        }, 300);
    }

    showFeedback(correct) {
        const feedback = document.getElementById('feedback');
        feedback.className = 'feedback ' + (correct ? 'correct' : 'incorrect');

        const { isSignificant, pValue, tStat, regression } = this.currentDataset;
        const actualResult = isSignificant ? 'SIGNIFICANT' : 'NOT SIGNIFICANT';
        const slopeDir = regression.slope > 0 ? 'positive' : 'negative';

        let message = correct ? '✓ Correct! ' : '✗ Incorrect. ';
        message += `The trend is ${actualResult}. `;
        message += `(p = ${pValue.toFixed(4)}, t = ${tStat.toFixed(2)}, slope = ${regression.slope.toFixed(3)})`;

        feedback.textContent = message;
    }

    showExplanation() {
        const explanation = document.getElementById('explanation');
        const { isSignificant } = this.currentDataset;

        if (isSignificant) {
            explanation.innerHTML = `
                <strong>Why is this significant?</strong> While the green line might not be exactly right, we can be ${this.settings.confidenceLevel}% confident the real slope is somewhere in the gray band around it. The null hypothesis (in red) is what the line would look like if there were no trend at all.
                <strong>Because the null hypothesis is outside of the ${this.settings.confidenceLevel}% confidence band, we can reject the null hypothesis and be confident there is a real trend.</strong>
            `;
        } else {
            explanation.innerHTML = `
                <strong>Why is this NOT significant?</strong> To have a significant trend we need to be confident that the green line is different from the red line. For this data set, we are ${this.settings.confidenceLevel}% confident the real trend is somewhere in the gray bands.
                <strong>Notice how the red null hypothesis line is inside the gray confidence band?</strong>
                This means the null hypothesis could be correct, and that there is no trend. The apparent pattern could be due to random variation.
            `;
        }

        explanation.className = 'explanation visible';
    }

    hideExplanation() {
        const explanation = document.getElementById('explanation');
        explanation.className = 'explanation';
    }

    disableGuessButtons() {
        document.getElementById('btnSignificant').disabled = true;
        document.getElementById('btnNotSignificant').disabled = true;
    }

    enableGuessButtons() {
        document.getElementById('btnSignificant').disabled = false;
        document.getElementById('btnNotSignificant').disabled = false;
    }

    nextRound() {
        const feedback = document.getElementById('feedback');
        feedback.className = 'feedback';
        feedback.textContent = '';

        // Hide explanation for next round
        this.hideExplanation();

        const gameControls = document.getElementById('gameControls');
        const nextContainer = document.getElementById('nextContainer');

        // Animate out next button
        nextContainer.classList.add('hiding');

        // Wait for shrink animation to complete, then swap buttons
        setTimeout(() => {
            nextContainer.classList.add('hidden');
            nextContainer.classList.remove('hiding');

            gameControls.classList.remove('hidden');
            gameControls.classList.add('showing');

            // Remove showing class after animation completes
            setTimeout(() => {
                gameControls.classList.remove('showing');
            }, 300);

            this.generateNewDataset();
        }, 300);
    }

    endGame() {
        const gameControls = document.getElementById('gameControls');

        // Remove any animation classes before hiding
        gameControls.classList.remove('hiding', 'showing');
        gameControls.classList.add('hidden');

        document.getElementById('finalScore').classList.add('show');
        document.getElementById('finalScoreValue').textContent = this.score;

        // Find matching outcome based on score
        const outcome = this.scoreOutcomes.find(
            o => this.score >= o.minScore && this.score <= o.maxScore
        );

        // Set image and message from outcome configuration
        const imageEl = document.getElementById('scoreImage');
        const messageEl = document.getElementById('scoreMessage');

        if (outcome) {
            imageEl.src = outcome.imageUrl;
            messageEl.textContent = outcome.message;
        } else {
            // Fallback in case no outcome matches
            imageEl.src = '';
            messageEl.textContent = 'Game complete!';
        }
    }

    restart() {
        this.attempts = 0;
        this.score = 0;

        const gameControls = document.getElementById('gameControls');
        const nextContainer = document.getElementById('nextContainer');
        const feedback = document.getElementById('feedback');

        // Remove any animation classes
        gameControls.classList.remove('hidden', 'hiding', 'showing');
        nextContainer.classList.add('hidden');
        nextContainer.classList.remove('hiding', 'showing');

        document.getElementById('finalScore').classList.remove('show');
        feedback.className = 'feedback';
        feedback.textContent = '';
        this.updateInfo();
        this.generateNewDataset();
    }

    attachEventListeners() {
        document.getElementById('btnSignificant').addEventListener('click', () => {
            this.makeGuess(true);
        });

        document.getElementById('btnNotSignificant').addEventListener('click', () => {
            this.makeGuess(false);
        });

        document.getElementById('btnNext').addEventListener('click', () => {
            this.nextRound();
        });

        document.getElementById('btnRestart').addEventListener('click', () => {
            this.restart();
        });

        // Settings toggle
        document.getElementById('settingsToggle').addEventListener('click', () => {
            const toggle = document.getElementById('settingsToggle');
            const content = document.getElementById('settingsContent');
            toggle.classList.toggle('open');
            content.classList.toggle('open');
        });

        // Confidence level buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                // Update display
                const confidence = btn.getAttribute('data-confidence');
                document.getElementById('confidenceDisplay').textContent = `${confidence}%`;
            });
        });

        // Month range inputs
        document.getElementById('minMonths').addEventListener('input', (e) => {
            const min = parseInt(e.target.value);
            const max = parseInt(document.getElementById('maxMonths').value);
            if (min <= max) {
                document.getElementById('monthDisplay').textContent = `${min}-${max}`;
            }
        });

        document.getElementById('maxMonths').addEventListener('input', (e) => {
            const min = parseInt(document.getElementById('minMonths').value);
            const max = parseInt(e.target.value);
            if (min <= max) {
                document.getElementById('monthDisplay').textContent = `${min}-${max}`;
            }
        });

        // Apply settings button
        document.getElementById('applySettings').addEventListener('click', () => {
            this.applySettings();
        });
    }

    applySettings() {
        // Get selected confidence level
        const activeBtn = document.querySelector('.option-btn.active');
        const confidenceLevel = parseInt(activeBtn.getAttribute('data-confidence'));

        // Get month range
        const minMonths = parseInt(document.getElementById('minMonths').value);
        const maxMonths = parseInt(document.getElementById('maxMonths').value);

        // Validate
        if (minMonths > maxMonths) {
            alert('Minimum months cannot be greater than maximum months!');
            return;
        }

        if (minMonths < 6 || maxMonths > 36) {
            alert('Month range must be between 6 and 36!');
            return;
        }

        // Update settings
        this.settings.confidenceLevel = confidenceLevel;
        this.settings.minMonths = minMonths;
        this.settings.maxMonths = maxMonths;

        // Update UI
        this.updateSubtitle();

        // Generate new dataset with new settings
        this.generateNewDataset();

        // Close settings panel
        document.getElementById('settingsToggle').classList.remove('open');
        document.getElementById('settingsContent').classList.remove('open');
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new StatisticalGame();
});
