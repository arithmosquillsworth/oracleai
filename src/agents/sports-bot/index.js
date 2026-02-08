import BaseAgent from '../../core/BaseAgent.js';
import { SignalAggregationSkill, ConfidenceScoringSkill, ExecutionSkill } from '../../skills/index.js';

/**
 * SportsBot - Specialized agent for sports predictions
 * Handles: Game outcomes, player props, tournament brackets, injury impact
 */
export class SportsBot extends BaseAgent {
  constructor(config = {}) {
    super({
      id: config.id || 'sports-bot',
      name: config.name || 'SportsBot',
      category: 'sports',
      minConfidence: config.minConfidence || 0.65,
      maxBetSize: config.maxBetSize || 200,
      ...config
    });

    this.leagues = config.leagues || ['NFL', 'NBA', 'MLB', 'NHL', 'Soccer'];
    this.marketTypes = ['game_winner', 'spread', 'total', 'player_props', 'futures'];
  }

  async init() {
    this.use(new SignalAggregationSkill({
      sources: ['news', 'social'],
      weights: { news: 0.6, social: 0.4 }
    }));

    this.use(new ConfidenceScoringSkill({
      calibrationEnabled: true,
      historyWeight: 0.25 // Less weight on history due to team/player changes
    }));

    this.use(new ExecutionSkill({
      platform: 'kalshi', // Sports betting on Kalshi
      dryRun: this.config.autoExecute !== true,
      bankroll: this.config.bankroll
    }));

    await super.init();
    console.log('[SportsBot] Tracking leagues:', this.leagues.join(', '));
  }

  async run() {
    console.log('[SportsBot] Scanning sports markets...');

    const allOpportunities = [];

    for (const league of this.leagues) {
      try {
        const markets = await this.scanLeagueMarkets(league);
        
        for (const market of markets) {
          const prediction = await this.predict(market);
          
          if (prediction.confidence >= this.config.minConfidence) {
            allOpportunities.push(prediction);
            
            if (this.config.autoExecute) {
              await this.execute(prediction);
            }
          }
        }
      } catch (err) {
        console.error(`[SportsBot] Error scanning ${league}:`, err.message);
      }
    }

    return allOpportunities;
  }

  /**
   * Scan markets for a specific league
   */
  async scanLeagueMarkets(league) {
    const execution = this.skill('execution');
    const client = execution.clients.kalshi;
    
    if (!client) return [];

    const markets = await client.listMarkets({
      active: true,
      limit: 50
    });

    // Filter by league keywords
    const leagueKeywords = {
      'NFL': ['nfl', 'football', 'super bowl'],
      'NBA': ['nba', 'basketball'],
      'MLB': ['mlb', 'baseball', 'world series'],
      'NHL': ['nhl', 'hockey', 'stanley cup'],
      'Soccer': ['soccer', 'epl', 'premier league', 'champions league', 'world cup']
    };

    const keywords = leagueKeywords[league] || [league.toLowerCase()];

    return markets.filter(m => {
      const text = `${m.title} ${m.description}`.toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });
  }

  /**
   * Generate prediction for a sports market
   */
  async predict(market) {
    const marketType = this.classifyMarketType(market);
    const signals = await this.aggregateSignals({ ...market, type: marketType });

    let rawPrediction;
    switch (marketType) {
      case 'game_winner':
        rawPrediction = await this.predictGameWinner(market, signals);
        break;
      case 'spread':
        rawPrediction = await this.predictSpread(market, signals);
        break;
      case 'total':
        rawPrediction = await this.predictTotal(market, signals);
        break;
      case 'player_props':
        rawPrediction = await this.predictPlayerProp(market, signals);
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
      category: 'sports',
      league: this.extractLeague(market),
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
    
    if (text.includes('spread') || text.includes('points') || text.match(/[+-]\d+\.?5?/)) {
      return 'spread';
    }
    if (text.includes('total') || text.includes('over/under') || text.includes('o/u')) {
      return 'total';
    }
    if (text.includes('player') || text.match(/\d+\.?\d*\s+(yards|points|goals|assists)/)) {
      return 'player_props';
    }
    if (text.includes('win') || text.includes('champion') || text.includes('defeat')) {
      return 'game_winner';
    }
    return 'generic';
  }

  extractLeague(market) {
    const text = `${market.title}`.toLowerCase();
    for (const league of this.leagues) {
      if (text.includes(league.toLowerCase())) return league;
    }
    return 'Unknown';
  }

  /**
   * Predict game winner
   */
  async predictGameWinner(market, signals) {
    const teams = this.extractTeams(market);
    
    // Analyze injury reports (from news signals)
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    let homeAdvantage = 0.05;
    let injuryImpact = 0;

    for (const signal of newsSignals) {
      const text = (signal.title || '').toLowerCase();
      
      // Check for injury mentions
      if (text.includes('injury') || text.includes('out') || text.includes('questionable')) {
        if (text.includes(teams.away?.toLowerCase())) {
          injuryImpact += 0.1; // Away team injured = home advantage
        }
        if (text.includes(teams.home?.toLowerCase())) {
          injuryImpact -= 0.1;
        }
      }
    }

    // Social sentiment
    const socialSignals = signals.signals.filter(s => s.type === 'social');
    const avgSentiment = socialSignals.reduce((sum, s) => sum + (s.sentiment || 0), 0) / 
      (socialSignals.length || 1);

    const score = 0.5 + homeAdvantage + injuryImpact + (avgSentiment * 0.1);
    const outcome = score > 0.5 ? 'yes' : 'no';

    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(score - 0.5),
      model: 'game_winner_v1',
      dataQuality: newsSignals.length > 2 ? 0.75 : 0.5
    };
  }

  /**
   * Predict against the spread
   */
  async predictSpread(market, signals) {
    const spread = this.extractSpread(market);
    
    // Similar to game winner but adjusted for spread
    const baseScore = await this.predictGameWinner(market, signals);
    
    // Adjust confidence based on spread size
    const spreadAdjustment = Math.abs(spread) > 7 ? -0.1 : 0;
    
    return {
      outcome: baseScore.outcome,
      rawConfidence: Math.max(0.5, baseScore.rawConfidence + spreadAdjustment),
      model: 'spread_v1',
      dataQuality: baseScore.dataQuality
    };
  }

  /**
   * Predict over/under total
   */
  async predictTotal(market, signals) {
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    
    let offensiveTrend = 0;
    let weatherImpact = 0;

    for (const signal of newsSignals) {
      const text = (signal.title || '').toLowerCase();
      
      // Look for offensive/defensive indicators
      if (text.includes('high scoring') || text.includes('offense')) {
        offensiveTrend += 0.1;
      }
      if (text.includes('defense') || text.includes('low scoring')) {
        offensiveTrend -= 0.1;
      }
      // Weather for outdoor sports
      if (text.includes('rain') || text.includes('snow') || text.includes('wind')) {
        weatherImpact -= 0.1;
      }
    }

    const score = 0.5 + offensiveTrend + weatherImpact;
    const outcome = score > 0.5 ? 'over' : 'under';

    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(score - 0.5),
      model: 'total_v1',
      dataQuality: newsSignals.length > 1 ? 0.7 : 0.5
    };
  }

  /**
   * Predict player prop
   */
  async predictPlayerProp(market, signals) {
    const player = this.extractPlayer(market);
    
    const newsSignals = signals.signals.filter(s => s.type === 'news');
    let recentForm = 0;
    let matchup = 0;

    for (const signal of newsSignals) {
      const text = (signal.title || '').toLowerCase();
      
      if (text.includes(player?.toLowerCase())) {
        if (text.includes('hot') || text.includes('streak')) {
          recentForm += 0.15;
        }
        if (text.includes('slump') || text.includes('cold')) {
          recentForm -= 0.15;
        }
        if (text.includes('vs') || text.includes('matchup')) {
          // Analyze matchup difficulty
          if (text.includes('weak') || text.includes('poor defense')) {
            matchup += 0.1;
          }
          if (text.includes('strong') || text.includes('tough defense')) {
            matchup -= 0.1;
          }
        }
      }
    }

    const score = 0.5 + recentForm + matchup;
    const outcome = score > 0.5 ? 'over' : 'under';

    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(score - 0.5),
      model: 'player_prop_v1',
      dataQuality: player ? 0.65 : 0.4
    };
  }

  async predictGeneric(market, signals) {
    const outcome = signals.score > 0.5 ? 'yes' : 'no';
    
    return {
      outcome,
      rawConfidence: 0.5 + Math.abs(signals.score - 0.5),
      model: 'signal_consensus',
      dataQuality: signals.signals.length > 2 ? 0.6 : 0.4
    };
  }

  // Helper methods
  extractTeams(market) {
    const text = market.title;
    const vsMatch = text.match(/(.+?)\s+(?:vs\.?|@|at)\s+(.+?)(?:\s|$)/i);
    if (vsMatch) {
      return { home: vsMatch[2].trim(), away: vsMatch[1].trim() };
    }
    return { home: null, away: null };
  }

  extractSpread(market) {
    const match = market.title.match(/([+-]\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  extractPlayer(market) {
    // Extract player name - this is simplified
    const words = market.title.split(' ');
    return words.slice(0, 2).join(' '); // First two words often contain name
  }
}

export default SportsBot;
