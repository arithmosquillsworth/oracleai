/**
 * SignalAggregationSkill - Aggregates data from multiple sources
 * News, social media, on-chain data, and custom feeds
 */
export class SignalAggregationSkill {
  constructor(config = {}) {
    this.name = 'aggregation';
    this.config = {
      sources: config.sources || ['news', 'social', 'onchain'],
      weights: config.weights || { news: 0.4, social: 0.3, onchain: 0.3 },
      cacheDuration: config.cacheDuration || 5 * 60 * 1000, // 5 minutes
      ...config
    };
    this.cache = new Map();
    this.agent = null;
  }

  attach(agent) {
    this.agent = agent;
  }

  async init() {
    console.log('[SignalAggregation] Initialized');
  }

  /**
   * Aggregate signals for a specific market/category
   */
  async aggregate(market, category) {
    const cacheKey = `${category}-${market.id || market}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
      return cached.data;
    }

    const sources = [];

    if (this.config.sources.includes('news')) {
      sources.push(this.fetchNewsSignals(market, category));
    }
    if (this.config.sources.includes('social')) {
      sources.push(this.fetchSocialSignals(market, category));
    }
    if (this.config.sources.includes('onchain')) {
      sources.push(this.fetchOnChainSignals(market, category));
    }

    const results = await Promise.allSettled(sources);
    const signals = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .flat();

    const weightedScore = this.calculateWeightedScore(signals);
    const result = {
      signals,
      score: weightedScore,
      timestamp: new Date().toISOString(),
      sourceCount: signals.length
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Fetch news-based signals
   */
  async fetchNewsSignals(market, category) {
    const signals = [];
    
    // Mock implementation - replace with actual RSS/API feeds
    const newsSources = this.getNewsSourcesForCategory(category);
    
    for (const source of newsSources) {
      try {
        const feed = await this.fetchRSS(source.url);
        const relevant = this.filterRelevant(feed, market);
        
        for (const item of relevant.slice(0, 5)) {
          signals.push({
            type: 'news',
            source: source.name,
            title: item.title,
            sentiment: this.analyzeSentiment(item),
            timestamp: item.date,
            weight: this.config.weights.news
          });
        }
      } catch (err) {
        console.warn(`[SignalAggregation] News fetch failed for ${source.name}:`, err.message);
      }
    }

    return signals;
  }

  /**
   * Fetch social media signals
   */
  async fetchSocialSignals(market, category) {
    const signals = [];
    
    // Mock implementation - replace with actual Twitter/X API
    const keywords = this.extractKeywords(market);
    
    signals.push({
      type: 'social',
      platform: 'twitter',
      volume: Math.floor(Math.random() * 1000),
      sentiment: (Math.random() * 2 - 1), // -1 to 1
      trending: Math.random() > 0.7,
      weight: this.config.weights.social
    });

    return signals;
  }

  /**
   * Fetch on-chain signals (crypto-specific)
   */
  async fetchOnChainSignals(market, category) {
    const signals = [];
    
    if (category !== 'crypto') return signals;

    // Mock implementation - replace with The Graph/Etherscan
    signals.push({
      type: 'onchain',
      metric: 'wallet_activity',
      value: Math.random() * 100,
      change24h: (Math.random() * 40 - 20),
      weight: this.config.weights.onchain
    });

    signals.push({
      type: 'onchain',
      metric: 'volume',
      value: Math.random() * 1000000,
      change24h: (Math.random() * 50 - 25),
      weight: this.config.weights.onchain
    });

    return signals;
  }

  /**
   * Calculate weighted aggregate score from signals
   */
  calculateWeightedScore(signals) {
    if (signals.length === 0) return 0.5;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const signal of signals) {
      const weight = signal.weight || 1;
      const score = this.normalizeSignal(signal);
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Normalize a signal to 0-1 range
   */
  normalizeSignal(signal) {
    switch (signal.type) {
      case 'news':
        return (signal.sentiment + 1) / 2; // -1,1 to 0,1
      case 'social':
        return (signal.sentiment + 1) / 2;
      case 'onchain':
        // Normalize based on change direction
        return signal.change24h > 0 ? 
          Math.min(0.5 + signal.change24h / 100, 1) :
          Math.max(0.5 + signal.change24h / 100, 0);
      default:
        return 0.5;
    }
  }

  /**
   * Simple sentiment analysis (placeholder)
   */
  analyzeSentiment(item) {
    const positive = ['bullish', 'up', 'growth', 'positive', 'win', 'success'];
    const negative = ['bearish', 'down', 'crash', 'negative', 'loss', 'fail'];
    
    const text = (item.title + ' ' + (item.description || '')).toLowerCase();
    let score = 0;
    
    for (const word of positive) {
      if (text.includes(word)) score += 0.1;
    }
    for (const word of negative) {
      if (text.includes(word)) score -= 0.1;
    }
    
    return Math.max(-1, Math.min(1, score));
  }

  getNewsSourcesForCategory(category) {
    const sources = {
      crypto: [
        { name: 'CoinDesk', url: 'https://coindesk.com/feed' },
        { name: 'TheBlock', url: 'https://theblock.co/feed' }
      ],
      sports: [
        { name: 'ESPN', url: 'https://espn.com/espn/rss/news' }
      ],
      politics: [
        { name: 'Politico', url: 'https://politico.com/rss/politics.xml' }
      ],
      popculture: [
        { name: 'Variety', url: 'https://variety.com/feed/' }
      ]
    };
    return sources[category] || [];
  }

  extractKeywords(market) {
    if (typeof market === 'string') return [market];
    return [market.title, market.description].filter(Boolean);
  }

  async fetchRSS(url) {
    // Placeholder - implement actual RSS fetching
    return [];
  }

  clearCache() {
    this.cache.clear();
  }
}

export default SignalAggregationSkill;
