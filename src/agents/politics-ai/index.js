import BaseAgent from '../../core/BaseAgent.js';
import { SignalAggregationSkill, ConfidenceScoringSkill, ExecutionSkill } from '../../skills/index.js';

/**
 * PoliticsAI - Specialized agent for political predictions
 * Handles: Elections, policy decisions, regulatory actions, international events
 */
export class PoliticsAI extends BaseAgent {
  constructor(config = {}) {
    super({
      id: config.id || 'politics-ai',
      name: config.name || 'PoliticsAI',
      category: 'politics',
      minConfidence: config.minConfidence || 0.75, // Higher threshold for politics
      maxBetSize: config.maxBetSize || 300,
      ...config
    });

    this.coverage = {
      elections: ['US Presidential', 'Congressional', 'State', 'International'],
      policy: ['Fed Policy', 'Legislation', 'Regulation', 'Trade'],
      geopolitical: ['Conflicts', 'Treaties', 'Sanctions']
    };
  }

  async init() {
    this.use(new SignalAggregationSkill({
      sources: ['news', 'social'],
      weights: { news: 0.7, social: 0.3 } // Heavy weight on news for politics
    }));

    this.use(new ConfidenceScoringSkill({
      calibrationEnabled: true,
      historyWeight: 0.4, // More weight on historical accuracy
      baseWeight: 0.2
    }));

    this.use(new ExecutionSkill({
      platform: 'kalshi', // Politics markets on Kalshi
      dryRun: this.config.autoExecute !== true,
      bankroll: this.config.bankroll
    }));

    await super.init();
    console.log('[PoliticsAI] Coverage:', JSON.stringify(this.coverage));
  }

  async run() {
    console.log('[PoliticsAI] Scanning political markets...');

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
        console.error(`[PoliticsAI] Error analyzing ${market.id}:`, err.message);
      }
    }

    return opportunities;
  }

  /**
   * Scan for political markets
   */
  async scanMarkets() {
    const execution = this.skill('execution');
    const client = execution.clients.kalshi;
    
    if (!client) return [];

    const allMarkets = await client.listMarkets({
      active: true,
      limit: 100
    });

    // Filter for political keywords
    const politicalKeywords = [
      'election', 'vote', 'poll', 'candidate', 'president', 'congress',
      'senate', 'house', 'governor', 'mayor', 'ballot', 'primary',
      'fed', 'federal reserve', 'interest rate', 'inflation',
      'legislation', 'bill', 'law', 'regulation', 'supreme court',
      'nomination', 'appointment', 'impeach', 'resign', 'election'
    ];

    return allMarkets.filter(m => {
      const text = `${m.title} ${m.description}`.toLowerCase();
      return politicalKeywords.some(kw => text.includes(kw));
    });
  }

  /**
   * Generate prediction for a political market
   */
  async predict(market) {
    const marketType = this.classifyMarketType(market);
    const signals = await this.aggregateSignals({ ...market, type: marketType });

    let rawPrediction;
    switch (marketType) {
      case 'election':
        rawPrediction = await this.predictElection(market, signals);
        break;
      case 'policy':
        rawPrediction = await this.predictPolicy(market, signals);
        break;
      case 'nomination':
        rawPrediction = await this.predictNomination(market, signals);
        break;
      case 'timeline':
        rawPrediction = await this.predictTimeline(market, signals);
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
      category: 'politics',
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
    
    if (text.includes('election') || text.includes('win') || text.includes('elect')) {
      return 'election';
    }
    if (text.includes('nominate') || text.includes('appointment') || text.includes('confirm')) {
      return 'nomination';
    }
    if (text.includes('fed') || text.includes('rate') || text.includes('legislation') || 
        text.includes('bill') || text.includes('policy')) {
      return 'policy';
    }
    if (text.includes('by') || text.includes('before') || text.includes('date') || text.includes('when')) {
      return 'timeline';
    }
    return 'generic';
  }

  /**
   * Predict election outcome using polling aggregation
   */
  async predictElection(market, signals) {
    const candidates = this.extractCandidates(market);
    
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    let pollingScore = 0.5;
    let momentumScore = 0;
    let scandalImpact = 0;

    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      // Look for poll mentions
      if (text.includes('poll') || text.includes('survey')) {
        // Parse poll numbers if present
        const percentMatch = text.match(/(\d+)%/g);
        if (percentMatch) {
          const percentages = percentMatch.map(p => parseInt(p));
          if (percentages.length >= 2) {
            const total = percentages.reduce((a, b) => a + b, 0);
            if (total > 80 && total < 120) { // Likely valid poll
              pollingScore = percentages[0] / (percentages[0] + percentages[1]);
            }
          }
        }
      }
      
      // Track momentum (recent trends)
      if (text.includes('surge') || text.includes('gaining') || text.includes('momentum')) {
        if (candidates.candidate1 && text.includes(candidates.candidate1.toLowerCase())) {
          momentumScore += 0.05;
        }
        if (candidates.candidate2 && text.includes(candidates.candidate2.toLowerCase())) {
          momentumScore -= 0.05;
        }
      }

      // Check for scandals/controversies
      if (text.includes('scandal') || text.includes('controversy') || text.includes('investigation')) {
        if (candidates.candidate1 && text.includes(candidates.candidate1.toLowerCase())) {
          scandalImpact -= 0.1;
        }
        if (candidates.candidate2 && text.includes(candidates.candidate2.toLowerCase())) {
          scandalImpact += 0.1;
        }
      }
    }

    // Social sentiment analysis
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    const socialMomentum = socialSignals.reduce((sum, s) => {
      return sum + (s.sentiment || 0) * (s.volume / 1000);
    }, 0) / (socialSignals.length || 1);

    const finalScore = pollingScore + momentumScore + scandalImpact + (socialMomentum * 0.05);
    const outcome = finalScore > 0.5 ? 'yes' : 'no';

    // Lower confidence far from election, higher closer to
    const daysToElection = this.extractDaysToEvent(market) || 30;
    const timeAdjustment = Math.min(daysToElection / 30, 1) * 0.15;

    return {
      outcome,
      rawConfidence: Math.max(0.5, 0.85 - timeAdjustment + Math.abs(finalScore - 0.5)),
      model: 'polling_aggregate_v1',
      dataQuality: newsSignals.filter(s => s.title?.toLowerCase().includes('poll')).length > 0 ? 0.8 : 0.5
    };
  }

  /**
   * Predict policy outcome (Fed decisions, legislation)
   */
  async predictPolicy(market, signals) {
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    
    let supportScore = 0.5;
    let expertConsensus = 0;
    let timeline = 0;

    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      // Fed policy signals
      if (text.includes('fed') || text.includes('federal reserve')) {
        if (text.includes('hawkish') || text.includes('raise') || text.includes('hike')) {
          supportScore += 0.1;
        }
        if (text.includes('dovish') || text.includes('cut') || text.includes('lower')) {
          supportScore -= 0.1;
        }
        if (text.includes('hold') || text.includes('pause') || text.includes('steady')) {
          supportScore = 0.5; // Reset to neutral
        }
      }

      // Legislation signals
      if (text.includes('bill') || text.includes('legislation')) {
        if (text.includes('pass') || text.includes('approve')) {
          supportScore += 0.15;
        }
        if (text.includes('block') || text.includes('reject') || text.includes('filibuster')) {
          supportScore -= 0.15;
        }
      }

      // Expert predictions
      if (text.includes('analyst') || text.includes('expert') || text.includes('predict')) {
        if (text.includes('likely') || text.includes('expected')) {
          expertConsensus += 0.05;
        }
      }
    }

    const score = supportScore + expertConsensus;
    const outcome = score > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: 0.6 + Math.abs(score - 0.5),
      model: 'policy_analysis_v1',
      dataQuality: newsSignals.length > 3 ? 0.75 : 0.5
    };
  }

  /**
   * Predict nomination/confirmation outcomes
   */
  async predictNomination(market, signals) {
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    
    let supportScore = 0.5;
    let opposition = 0;
    let bipartisan = 0;

    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      if (text.includes('support') || text.includes('endorse')) {
        supportScore += 0.1;
      }
      if (text.includes('oppose') || text.includes('reject') || text.includes('concern')) {
        opposition += 0.1;
      }
      if (text.includes('bipartisan') || text.includes('both parties')) {
        bipartisan += 0.15;
      }
    }

    const finalScore = supportScore - opposition + bipartisan;
    const outcome = finalScore > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: 0.65 + Math.min(Math.abs(finalScore - 0.5), 0.25),
      model: 'nomination_v1',
      dataQuality: newsSignals.length > 2 ? 0.7 : 0.5
    };
  }

  /**
   * Predict timeline events (when will X happen)
   */
  async predictTimeline(market, signals) {
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    
    let urgency = 0;
    let delays = 0;

    for (const signal of newsSignals) {
      const text = (signal.title + ' ' + (signal.description || '')).toLowerCase();
      
      if (text.includes('urgent') || text.includes('fast-track') || text.includes('imminent')) {
        urgency += 0.2;
      }
      if (text.includes('delay') || text.includes('postpone') || text.includes('push back')) {
        delays += 0.2;
      }
    }

    const score = 0.5 + urgency - delays;
    const outcome = score > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: 0.55 + Math.min(Math.abs(score - 0.5), 0.2),
      model: 'timeline_v1',
      dataQuality: 0.5
    };
  }

  async predictGeneric(market, signals) {
    const outcome = signals.score > 0.5 ? 'yes' : 'no';
    
    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(signals.score - 0.5) * 0.8,
      model: 'signal_consensus',
      dataQuality: signals.signals.length > 2 ? 0.6 : 0.4
    };
  }

  // Helper methods
  extractCandidates(market) {
    const text = market.title;
    // Try to extract candidate names (simplified)
    const vsMatch = text.match(/(.+?)\s+(?:vs\.?|defeat|beat|win)\s+(.+?)(?:\s|$|\?)/i);
    if (vsMatch) {
      return { candidate1: vsMatch[1].trim(), candidate2: vsMatch[2].trim() };
    }
    return { candidate1: null, candidate2: null };
  }

  extractDaysToEvent(market) {
    // Try to extract days from market title or description
    const daysMatch = market.title.match(/(\d+)\s+days?/i);
    if (daysMatch) return parseInt(daysMatch[1]);
    return null;
  }
}

export default PoliticsAI;
