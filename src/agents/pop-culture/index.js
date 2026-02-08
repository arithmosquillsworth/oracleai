import BaseAgent from '../../core/BaseAgent.js';
import { SignalAggregationSkill, ConfidenceScoringSkill, ExecutionSkill } from '../../skills/index.js';

/**
 * PopCulture - Specialized agent for entertainment/pop culture predictions
 * Handles: Awards, trending topics, viral predictions, celebrity events
 */
export class PopCulture extends BaseAgent {
  constructor(config = {}) {
    super({
      id: config.id || 'pop-culture',
      name: config.name || 'PopCulture',
      category: 'popculture',
      minConfidence: config.minConfidence || 0.60,
      maxBetSize: config.maxBetSize || 100,
      ...config
    });

    this.events = {
      awards: ['Oscars', 'Grammys', 'Emmys', 'Golden Globes', 'Tonys'],
      trending: ['Viral Predictions', 'Social Media Milestones'],
      celebrity: ['Relationships', 'Announcements', 'Controversies'],
      media: ['Box Office', 'Streaming', 'Chart Performance']
    };
  }

  async init() {
    this.use(new SignalAggregationSkill({
      sources: ['news', 'social'],
      weights: { news: 0.3, social: 0.7 } // Heavy on social for pop culture
    }));

    this.use(new ConfidenceScoringSkill({
      calibrationEnabled: true,
      signalWeight: 0.6, // Very high weight on signals
      historyWeight: 0.1 // Less on history (trends change fast)
    }));

    this.use(new ExecutionSkill({
      platform: 'kalshi',
      dryRun: this.config.autoExecute !== true,
      bankroll: this.config.bankroll
    }));

    await super.init();
    console.log('[PopCulture] Tracking:', Object.keys(this.events).join(', '));
  }

  async run() {
    console.log('[PopCulture] Scanning entertainment markets...');

    const markets = await this.scanMarkets();
    const opportunities = [];

    for (const market of markets) {
      try {
        const prediction = await this.predict(market);
        
        if (prediction.confidence >= this.config.minConfidence) {
          opportunities.push(prediction);
          
          if (this.config.autoExecute) {
            await this.execute(prediction);
          }
        }
      } catch (err) {
        console.error(`[PopCulture] Error analyzing ${market.id}:`, err.message);
      }
    }

    return opportunities;
  }

  /**
   * Scan for pop culture markets
   */
  async scanMarkets() {
    const execution = this.skill('execution');
    const client = execution.clients.kalshi;
    
    if (!client) return [];

    const allMarkets = await client.listMarkets({
      active: true,
      limit: 100
    });

    // Filter for entertainment/pop culture keywords
    const popKeywords = [
      'oscar', 'academy award', 'grammy', 'emmy', 'golden globe', 'tony',
      'movie', 'film', 'actor', 'actress', 'director',
      'song', 'album', 'artist', 'chart', 'billboard', 'spotify',
      'box office', 'streaming', 'netflix', 'disney',
      'celebrity', 'wedding', 'divorce', 'baby', 'pregnant',
      'trending', 'viral', 'meme', 'tiktok', 'twitter', 'x'
    ];

    return allMarkets.filter(m => {
      const text = `${m.title} ${m.description}`.toLowerCase();
      return popKeywords.some(kw => text.includes(kw));
    });
  }

  /**
   * Generate prediction for a pop culture market
   */
  async predict(market) {
    const marketType = this.classifyMarketType(market);
    const signals = await this.aggregateSignals({ ...market, type: marketType });

    let rawPrediction;
    switch (marketType) {
      case 'awards':
        rawPrediction = await this.predictAwards(market, signals);
        break;
      case 'box_office':
        rawPrediction = await this.predictBoxOffice(market, signals);
        break;
      case 'music_charts':
        rawPrediction = await this.predictMusicCharts(market, signals);
        break;
      case 'viral':
        rawPrediction = await this.predictViral(market, signals);
        break;
      case 'celebrity':
        rawPrediction = await this.predictCelebrity(market, signals);
        break;
      default:
        rawPrediction = await this.predictGeneric(market, signals);
    }

    const confidence = this.calculateConfidence(rawPrediction, signals);

    return {
      id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: this.id,
      marketId: market.id,
      marketTitle: market.title,
      category: 'popculture',
      type: marketType,
      outcome: rawPrediction.outcome,
      confidence,
      rawConfidence: rawPrediction.rawConfidence,
      signals: signals.signals.length,
      signalScore: signals.score,
      marketPrice: market.bestPrice || market.price,
      timestamp: new Date().toISOString()
    };
  }

  classifyMarketType(market) {
    const text = `${market.title} ${market.description}`.toLowerCase();
    
    if (text.includes('oscar') || text.includes('grammy') || text.includes('emmy') || 
        text.includes('award') || text.includes('win')) {
      return 'awards';
    }
    if (text.includes('box office') || text.includes('opening') || text.match(/\$\d+m/)) {
      return 'box_office';
    }
    if (text.includes('billboard') || text.includes('chart') || text.includes('stream') ||
        text.includes('spotify') || text.includes('number one')) {
      return 'music_charts';
    }
    if (text.includes('viral') || text.includes('trending') || text.includes('views') ||
        text.includes('followers') || text.includes('subscribers')) {
      return 'viral';
    }
    if (text.includes('married') || text.includes('wedding') || text.includes('divorce') ||
        text.includes('dating') || text.includes('baby') || text.includes('pregnant')) {
      return 'celebrity';
    }
    return 'generic';
  }

  /**
   * Predict awards outcomes
   */
  async predictAwards(market, signals) {
    const nominees = this.extractNominees(market);
    
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    
    let buzzScore = {};

    // Initialize scores
    for (const nominee of nominees) {
      buzzScore[nominee] = 0;
    }

    // Analyze news buzz
    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      for (const nominee of nominees) {
        if (text.includes(nominee.toLowerCase())) {
          buzzScore[nominee] += 0.1;
          
          // Check for precursor wins
          if (text.includes('win') || text.includes('won') || text.includes('victory')) {
            buzzScore[nominee] += 0.2;
          }
          
          // Critics sentiment
          if (text.includes('critics') || text.includes('review')) {
            if (text.includes('rave') || text.includes('praise') || text.includes('masterpiece')) {
              buzzScore[nominee] += 0.15;
            }
          }
        }
      }
    }

    // Social media momentum (very important for awards)
    for (const signal of socialSignals) {
      for (const nominee of nominees) {
        if (signal.mentions?.includes(nominee.toLowerCase())) {
          buzzScore[nominee] += (signal.sentiment || 0) * (signal.volume / 10000);
        }
      }
    }

    // Find the leader
    let winner = nominees[0];
    let maxScore = -Infinity;
    
    for (const [nominee, score] of Object.entries(buzzScore)) {
      if (score > maxScore) {
        maxScore = score;
        winner = nominee;
      }
    }

    const runnerUp = Object.entries(buzzScore)
      .sort((a, b) => b[1] - a[1])[1];

    const margin = maxScore - (runnerUp?.[1] || 0);
    const outcome = this.determineOutcomeFromNominee(market, winner);

    return {
      outcome,
      rawConfidence: Math.min(0.5 + margin + 0.3, 0.85),
      model: 'awards_buzz_v1',
      dataQuality: socialSignals.length > 0 ? 0.7 : 0.4,
      metadata: { winner, buzzScores: buzzScore }
    };
  }

  /**
   * Predict box office performance
   */
  async predictBoxOffice(market, signals) {
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    
    let hypeScore = 0;
    let reviewScore = 0;
    let franchiseBoost = 0;

    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      // Pre-sales tracking
      if (text.includes('pre-sale') || text.includes('ticket') || text.includes('sold out')) {
        if (text.includes('record') || text.includes('strong')) {
          hypeScore += 0.2;
        }
      }

      // Reviews
      if (text.includes('review') || text.includes('rotten tomatoes')) {
        const rtMatch = text.match(/(\d+)%/);
        if (rtMatch) {
          reviewScore = parseInt(rtMatch[1]) / 100;
        }
      }

      // Franchise power
      if (text.includes('sequel') || text.includes('franchise') || text.includes('marvel') ||
          text.includes('star wars') || text.includes('dc')) {
        franchiseBoost += 0.1;
      }
    }

    // Social buzz
    const socialVolume = socialSignals.reduce((sum, s) => sum + (s.volume || 0), 0);
    const socialSentiment = socialSignals.reduce((sum, s) => sum + (s.sentiment || 0), 0) / 
      (socialSignals.length || 1);

    const socialScore = (socialVolume / 50000) * socialSentiment;

    const finalScore = 0.3 + hypeScore + (reviewScore * 0.2) + franchiseBoost + socialScore;
    const outcome = finalScore > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: Math.min(0.5 + Math.abs(finalScore - 0.5), 0.75),
      model: 'box_office_v1',
      dataQuality: newsSignals.length > 2 ? 0.7 : 0.5
    };
  }

  /**
   * Predict music chart performance
   */
  async predictMusicCharts(market, signals) {
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    
    let streamMomentum = 0;
    let viralCoefficient = 0;

    for (const signal of socialSignals) {
      const volume = signal.volume || 0;
      const sentiment = signal.sentiment || 0;
      
      streamMomentum += (volume / 100000) * sentiment;
      
      if (signal.trending) {
        viralCoefficient += 0.2;
      }
    }

    const score = 0.5 + streamMomentum + viralCoefficient;
    const outcome = score > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: Math.min(0.55 + Math.abs(score - 0.5), 0.8),
      model: 'chart_prediction_v1',
      dataQuality: socialSignals.length > 0 ? 0.6 : 0.3
    };
  }

  /**
   * Predict viral/trending events
   */
  async predictViral(market, signals) {
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    
    let velocity = 0;
    let acceleration = 0;
    let previousVolume = 0;

    for (const signal of socialSignals) {
      const volume = signal.volume || 0;
      
      if (previousVolume > 0) {
        const growth = (volume - previousVolume) / previousVolume;
        acceleration += growth;
      }
      previousVolume = volume;
      
      velocity += volume / 100000;
    }

    // High velocity + positive acceleration = likely to hit milestone
    const score = Math.min(velocity + acceleration, 1);
    const outcome = score > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: Math.min(0.5 + score * 0.3, 0.7),
      model: 'viral_prediction_v1',
      dataQuality: socialSignals.length > 1 ? 0.5 : 0.3
    };
  }

  /**
   * Predict celebrity events
   */
  async predictCelebrity(market, signals) {
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    
    let evidenceScore = 0;
    let denialScore = 0;

    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      // Look for confirmations
      if (text.includes('confirm') || text.includes('announce') || text.includes('reveal')) {
        evidenceScore += 0.2;
      }
      
      // Look for denials
      if (text.includes('deny') || text.includes('rumor') || text.includes('false')) {
        denialScore += 0.15;
      }

      // Multiple sources reporting
      if (text.includes('report') || text.includes('source')) {
        evidenceScore += 0.05;
      }
    }

    // Social reaction can indicate truth
    const socialIntensity = socialSignals.reduce((sum, s) => sum + (s.volume || 0), 0);
    if (socialIntensity > 100000) {
      evidenceScore += 0.1; // High chatter often precedes confirmation
    }

    const score = 0.5 + evidenceScore - denialScore;
    const outcome = score > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: Math.min(0.5 + Math.abs(score - 0.5), 0.7),
      model: 'celevent_prediction_v1',
      dataQuality: newsSignals.length > 1 ? 0.55 : 0.35
    };
  }

  async predictGeneric(market, signals) {
    const outcome = signals.score > 0.5 ? 'yes' : 'no';
    
    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(signals.score - 0.5),
      model: 'signal_consensus',
      dataQuality: signals.signals.length > 2 ? 0.5 : 0.3
    };
  }

  // Helper methods
  extractNominees(market) {
    const text = market.title;
    // Try to extract nominee names - common patterns
    // "Will X, Y, or Z win..."
    const orMatch = text.match(/Will\s+(.+?)\s+win/i);
    if (orMatch) {
      const candidates = orMatch[1].split(/,|\s+or\s+/).map(s => s.trim());
      return candidates.filter(c => c.length > 2);
    }
    return ['Option A', 'Option B'];
  }

  determineOutcomeFromNominee(market, nominee) {
    // Determine if the leading nominee corresponds to "yes" or "no"
    const text = market.title.toLowerCase();
    
    // If market asks "Will X win?" and X is the leader, return yes
    if (text.includes(nominee.toLowerCase()) && text.includes('win')) {
      return 'yes';
    }
    
    return 'yes'; // Default
  }
}

export default PopCulture;
