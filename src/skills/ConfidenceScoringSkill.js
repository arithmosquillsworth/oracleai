/**
 * ConfidenceScoringSkill - Calculates prediction confidence using
 * historical performance, signal strength, and market conditions
 */
export class ConfidenceScoringSkill {
  constructor(config = {}) {
    this.name = 'scoring';
    this.config = {
      baseWeight: config.baseWeight || 0.3,
      signalWeight: config.signalWeight || 0.4,
      historyWeight: config.historyWeight || 0.3,
      calibrationEnabled: config.calibrationEnabled ?? true,
      minSamplesForHistory: config.minSamplesForHistory || 10,
      ...config
    };
    this.calibrationData = new Map();
    this.agent = null;
  }

  attach(agent) {
    this.agent = agent;
  }

  async init() {
    console.log('[ConfidenceScoring] Initialized');
  }

  /**
   * Calculate confidence score for a prediction
   * @param {Object} prediction - Raw prediction data
   * @param {Object} signals - Aggregated signals
   * @param {Object} performance - Agent's historical performance
   * @returns {number} Confidence score 0-1
   */
  calculate(prediction, signals, performance) {
    const components = {
      base: this.calculateBaseConfidence(prediction),
      signal: this.calculateSignalConfidence(signals),
      history: this.calculateHistoryConfidence(performance, prediction)
    };

    let confidence = (
      components.base * this.config.baseWeight +
      components.signal * this.config.signalWeight +
      components.history * this.config.historyWeight
    );

    // Apply calibration if enabled
    if (this.config.calibrationEnabled) {
      confidence = this.applyCalibration(confidence, prediction.marketType);
    }

    // Apply market condition adjustments
    confidence = this.applyMarketAdjustments(confidence, signals);

    return Math.min(Math.max(confidence, 0.01), 0.99);
  }

  /**
   * Calculate base confidence from prediction internals
   */
  calculateBaseConfidence(prediction) {
    let score = prediction.rawConfidence || 0.5;

    // Adjust based on prediction methodology
    if (prediction.model === 'ensemble') {
      score *= 1.1; // Ensemble models get a boost
    } else if (prediction.model === 'naive') {
      score *= 0.9;
    }

    // Adjust based on data quality
    if (prediction.dataQuality) {
      score *= (0.5 + prediction.dataQuality * 0.5);
    }

    return Math.min(score, 0.95);
  }

  /**
   * Calculate confidence from aggregated signals
   */
  calculateSignalConfidence(signals) {
    if (!signals || !signals.signals || signals.signals.length === 0) {
      return 0.5;
    }

    const sigs = signals.signals;
    
    // Consensus score - how aligned are the signals?
    const sentimentSignals = sigs.filter(s => s.sentiment !== undefined);
    let consensusScore = 0.5;
    
    if (sentimentSignals.length > 1) {
      const sentiments = sentimentSignals.map(s => s.sentiment);
      const variance = this.calculateVariance(sentiments);
      consensusScore = Math.max(0, 1 - variance); // Lower variance = higher consensus
    }

    // Source diversity score
    const sourceTypes = new Set(sigs.map(s => s.type)).size;
    const diversityScore = Math.min(sourceTypes / 3, 1);

    // Signal strength score
    const avgSignalStrength = sigs.reduce((sum, s) => {
      return sum + Math.abs(s.sentiment || 0.5);
    }, 0) / sigs.length;

    return (consensusScore * 0.4 + diversityScore * 0.3 + avgSignalStrength * 0.3);
  }

  /**
   * Calculate confidence based on historical performance
   */
  calculateHistoryConfidence(performance, prediction) {
    if (!performance || performance.total < this.config.minSamplesForHistory) {
      return 0.5; // Neutral if insufficient history
    }

    let score = performance.winRate || 0.5;

    // Adjust based on recent performance trend
    if (performance.recentWinRate) {
      score = score * 0.6 + performance.recentWinRate * 0.4;
    }

    // Adjust based on confidence calibration
    const calibration = this.getCalibrationForConfidence(prediction.rawConfidence);
    if (calibration) {
      score = score * 0.7 + calibration.accuracy * 0.3;
    }

    // Penalize if PnL is negative
    if (performance.pnl < 0) {
      score *= 0.8;
    }

    return score;
  }

  /**
   * Apply calibration curve to adjust for over/under-confidence
   */
  applyCalibration(confidence, marketType) {
    const cal = this.calibrationData.get(marketType) || this.calibrationData.get('default');
    
    if (!cal || cal.samples < 20) {
      return confidence;
    }

    // Find calibration bucket
    const bucket = Math.floor(confidence * 10) / 10;
    const bucketData = cal.buckets[bucket];

    if (bucketData && bucketData.samples > 5) {
      // Adjust confidence towards actual accuracy
      const adjustment = (bucketData.accuracy - confidence) * 0.3;
      return confidence + adjustment;
    }

    return confidence;
  }

  /**
   * Apply adjustments based on market conditions
   */
  applyMarketAdjustments(confidence, signals) {
    let adjusted = confidence;

    // Reduce confidence in highly volatile conditions
    if (signals.volatility) {
      if (signals.volatility > 0.8) {
        adjusted *= 0.85;
      } else if (signals.volatility > 0.5) {
        adjusted *= 0.95;
      }
    }

    // Reduce confidence if low liquidity
    if (signals.liquidity < 10000) {
      adjusted *= 0.9;
    }

    return adjusted;
  }

  /**
   * Record outcome for calibration
   */
  recordOutcome(predictedConfidence, actualOutcome, marketType = 'default') {
    const bucket = Math.floor(predictedConfidence * 10) / 10;
    
    if (!this.calibrationData.has(marketType)) {
      this.calibrationData.set(marketType, {
        samples: 0,
        buckets: {}
      });
    }

    const cal = this.calibrationData.get(marketType);
    cal.samples++;

    if (!cal.buckets[bucket]) {
      cal.buckets[bucket] = { samples: 0, correct: 0 };
    }

    cal.buckets[bucket].samples++;
    if (actualOutcome) {
      cal.buckets[bucket].correct++;
    }

    // Recalculate accuracies
    for (const b in cal.buckets) {
      const bucketData = cal.buckets[b];
      bucketData.accuracy = bucketData.correct / bucketData.samples;
    }
  }

  getCalibrationForConfidence(confidence) {
    const bucket = Math.floor(confidence * 10) / 10;
    const cal = this.calibrationData.get('default');
    return cal?.buckets?.[bucket];
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  getCalibrationReport() {
    const report = {};
    for (const [marketType, data] of this.calibrationData) {
      report[marketType] = {
        samples: data.samples,
        buckets: data.buckets
      };
    }
    return report;
  }
}

export default ConfidenceScoringSkill;
