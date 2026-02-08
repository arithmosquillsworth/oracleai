import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CryptoOracle, SportsBot, PoliticsAI, PopCulture } from '../src/agents/index.js';
import { SignalAggregationSkill, ConfidenceScoringSkill, ExecutionSkill } from '../src/skills/index.js';

describe('OracleAI Agents', () => {
  describe('CryptoOracle', () => {
    it('should initialize with correct configuration', async () => {
      const agent = new CryptoOracle({ minConfidence: 0.75 });
      assert.strictEqual(agent.category, 'crypto');
      assert.strictEqual(agent.config.minConfidence, 0.75);
    });

    it('should register skills', async () => {
      const agent = new CryptoOracle();
      agent.use(new SignalAggregationSkill());
      agent.use(new ConfidenceScoringSkill());
      agent.use(new ExecutionSkill({ platform: 'polymarket' }));
      
      assert.strictEqual(agent.skills.has('aggregation'), true);
      assert.strictEqual(agent.skills.has('scoring'), true);
      assert.strictEqual(agent.skills.has('execution'), true);
    });
  });

  describe('SportsBot', () => {
    it('should initialize with leagues', async () => {
      const agent = new SportsBot({ leagues: ['NBA', 'NFL'] });
      assert.deepStrictEqual(agent.leagues, ['NBA', 'NFL']);
    });
  });

  describe('PoliticsAI', () => {
    it('should have higher confidence threshold', async () => {
      const agent = new PoliticsAI();
      assert.strictEqual(agent.config.minConfidence, 0.75);
    });
  });

  describe('PopCulture', () => {
    it('should track entertainment events', async () => {
      const agent = new PopCulture();
      assert.ok(agent.events.awards.includes('Oscars'));
      assert.ok(agent.events.awards.includes('Grammys'));
    });
  });
});

describe('Skills', () => {
  describe('SignalAggregationSkill', () => {
    it('should calculate weighted scores', async () => {
      const skill = new SignalAggregationSkill();
      const signals = [
        { type: 'news', sentiment: 0.8, weight: 0.4 },
        { type: 'social', sentiment: 0.6, weight: 0.3 }
      ];
      const score = skill.calculateWeightedScore(signals);
      assert.ok(score >= 0 && score <= 1);
    });
  });

  describe('ConfidenceScoringSkill', () => {
    it('should calculate confidence with components', async () => {
      const skill = new ConfidenceScoringSkill();
      const prediction = { rawConfidence: 0.7, model: 'test' };
      const signals = { signals: [], score: 0.6 };
      const performance = { total: 50, wins: 30, winRate: 0.6 };
      
      const confidence = skill.calculate(prediction, signals, performance);
      assert.ok(confidence >= 0 && confidence <= 1);
    });
  });

  describe('ExecutionSkill', () => {
    it('should calculate position size using Kelly criterion', async () => {
      const skill = new ExecutionSkill({ bankroll: 1000 });
      const prediction = {
        confidence: 0.7,
        marketPrice: 0.55
      };
      
      const size = skill.calculatePositionSize(prediction);
      assert.ok(size > 0);
      assert.ok(size <= 1000);
    });
  });
});
