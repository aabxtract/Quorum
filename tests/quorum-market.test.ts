import { describe, it, expect, beforeAll } from 'vitest'
import { initSimnet } from '@hirosystems/clarinet-sdk'

// v7-style ClarityValue helpers (compatible with clarinet-sdk's bundled @stacks/transactions)
const cv = {
  uint: (n: number | bigint) => ({ type: 'uint' as const, value: BigInt(n) }),
  principal: (addr: string) => ({ type: 'address' as const, value: addr }),
  ascii: (s: string) => ({ type: 'ascii' as const, value: s }),
  boolTrue: () => ({ type: 'true' as const }),
  boolFalse: () => ({ type: 'false' as const }),
  none: () => ({ type: 'none' as const }),
  some: (v: any) => ({ type: 'some' as const, value: v }),
  ok: (v: any) => ({ type: 'ok' as const, value: v }),
  err: (v: any) => ({ type: 'err' as const, value: v }),
  tuple: (data: Record<string, any>) => ({ type: 'tuple' as const, value: data }),
}

const DEPLOYER = 'ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70'
const OTHER = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
const MARKET_ID = 'test-market-001'

let simnet: Awaited<ReturnType<typeof initSimnet>>

beforeAll(async () => {
  simnet = await initSimnet()
})

describe('quorum-market', () => {
  // ── Ownership ─────────────────────────────────────────────
  describe('ownership', () => {
    it('sets contract-owner to deployer', () => {
      const result = simnet.getDataVar('quorum-market', 'contract-owner')
      expect(result).toBePrincipal(DEPLOYER)
    })

    it('allows owner to transfer ownership', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'transfer-ownership', args: [cv.principal(OTHER)], sender: DEPLOYER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const owner = simnet.getDataVar('quorum-market', 'contract-owner')
      expect(owner).toBePrincipal(OTHER)
    })

    it('rejects ownership transfer from non-owner', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'transfer-ownership', args: [cv.principal(DEPLOYER)], sender: DEPLOYER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(100))
    })
  })

  // ── Agent ──────────────────────────────────────────────────
  describe('agent', () => {
    it('returns deployer as initial agent', () => {
      // agent-address defaults to contract-owner which is now OTHER
      // Actually, ownership was transferred so contract-owner is OTHER,
      // but agent-address was set at deploy time to the original deployer.
      // Let's check get-agent via read-only call
      // get-agent is defined-read-only so use callReadOnlyFn
      const result = simnet.callReadOnlyFn('quorum-market', 'get-agent', [], DEPLOYER)
      // Should still be the deployer since set-agent was never called
      expect(result.result).toBePrincipal('ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70')
    })

    it('allows owner to set new agent', () => {
      // contract-owner is now OTHER after ownership transfer
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'set-agent', args: [cv.principal(OTHER)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const agent = simnet.getDataVar('quorum-market', 'agent-address')
      expect(agent).toBePrincipal(OTHER)
    })

    it('rejects set-agent from non-owner', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'set-agent', args: [cv.principal(DEPLOYER)], sender: DEPLOYER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(100))
    })
  })

  // ── Create Market ──────────────────────────────────────────
  describe('create-market', () => {
    it('allows agent to create a market', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'create-market', args: [cv.ascii(MARKET_ID)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const mkt = simnet.getMapEntry('quorum-market', 'markets', cv.tuple({ 'market-id': cv.ascii(MARKET_ID) }))
      expect(mkt).toBeSome(cv.tuple({
        status: cv.uint(0),
        'yes-pool': cv.uint(0),
        'no-pool': cv.uint(0),
        'winning-side': cv.none(),
        'resolution-price': cv.uint(0),
      }))
    })

    it('rejects duplicate market id', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'create-market', args: [cv.ascii(MARKET_ID)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(107))
    })

    it('rejects non-agent caller', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'create-market', args: [cv.ascii('market-002')], sender: DEPLOYER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(108))
    })
  })

  // ── Record Stake ───────────────────────────────────────────
  describe('record-stake', () => {
    it('allows agent to record a YES stake', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(1), cv.uint(1000000)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const stake = simnet.getMapEntry('quorum-market', 'stakes', cv.tuple({ 'market-id': cv.ascii(MARKET_ID), staker: cv.principal(DEPLOYER), side: cv.uint(1) }))
      expect(stake).toBeSome(cv.tuple({
        amount: cv.uint(1000000),
        'paid-out': cv.boolFalse(),
      }))

      const mkt = simnet.getMapEntry('quorum-market', 'markets', cv.tuple({ 'market-id': cv.ascii(MARKET_ID) }))
      expect(mkt).toBeSome(cv.tuple({
        status: cv.uint(0),
        'yes-pool': cv.uint(1000000),
        'no-pool': cv.uint(0),
        'winning-side': cv.none(),
        'resolution-price': cv.uint(0),
      }))
    })

    it('allows agent to record a NO stake', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(0), cv.uint(2000000)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const mkt = simnet.getMapEntry('quorum-market', 'markets', cv.tuple({ 'market-id': cv.ascii(MARKET_ID) }))
      expect(mkt).toBeSome(cv.tuple({
        status: cv.uint(0),
        'yes-pool': cv.uint(1000000),
        'no-pool': cv.uint(2000000),
        'winning-side': cv.none(),
        'resolution-price': cv.uint(0),
      }))
    })

    it('accumulates stake amount on second deposit', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(1), cv.uint(500000)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const stake = simnet.getMapEntry('quorum-market', 'stakes', cv.tuple({ 'market-id': cv.ascii(MARKET_ID), staker: cv.principal(DEPLOYER), side: cv.uint(1) }))
      expect(stake).toBeSome(cv.tuple({
        amount: cv.uint(1500000),
        'paid-out': cv.boolFalse(),
      }))
    })

    it('rejects non-agent caller', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(1), cv.uint(100)], sender: DEPLOYER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(108))
    })

    it('rejects non-existent market', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii('nonexistent'), cv.principal(DEPLOYER), cv.uint(1), cv.uint(100)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(102))
    })

    it('rejects invalid side', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(2), cv.uint(100)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(104))
    })

    it('rejects zero amount', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(1), cv.uint(0)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(105))
    })
  })

  // ── Resolve Market ─────────────────────────────────────────
  describe('resolve-market', () => {
    it('allows agent to resolve market', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'resolve-market', args: [cv.ascii(MARKET_ID), cv.uint(1), cv.uint(6200000000)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const mkt = simnet.getMapEntry('quorum-market', 'markets', cv.tuple({ 'market-id': cv.ascii(MARKET_ID) }))
      expect(mkt).toBeSome(cv.tuple({
        status: cv.uint(1),
        'yes-pool': cv.uint(1500000),
        'no-pool': cv.uint(2000000),
        'winning-side': cv.some(cv.uint(1)),
        'resolution-price': cv.uint(6200000000),
      }))
    })

    it('rejects double resolution', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'resolve-market', args: [cv.ascii(MARKET_ID), cv.uint(1), cv.uint(6300000000)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(103))
    })
  })

  // ── Mark Paid Out ──────────────────────────────────────────
  describe('mark-paid-out', () => {
    it('allows agent to mark winner paid', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'mark-paid-out', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER)], sender: OTHER } }
      ])
      expect(block[0].result).toBeOk(cv.boolTrue())

      const stake = simnet.getMapEntry('quorum-market', 'stakes', cv.tuple({ 'market-id': cv.ascii(MARKET_ID), staker: cv.principal(DEPLOYER), side: cv.uint(1) }))
      expect(stake).toBeSome(cv.tuple({
        amount: cv.uint(1500000),
        'paid-out': cv.boolTrue(),
      }))
    })

    it('rejects double payout', () => {
      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'mark-paid-out', args: [cv.ascii(MARKET_ID), cv.principal(DEPLOYER)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(103))
    })

    it('rejects unresolved market', () => {
      // Create a new market, record stake, try to mark paid (not resolved yet)
      simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'create-market', args: [cv.ascii('market-004')], sender: OTHER } },
        { callPublicFn: { contract: 'quorum-market', method: 'record-stake', args: [cv.ascii('market-004'), cv.principal(DEPLOYER), cv.uint(1), cv.uint(100)], sender: OTHER } },
      ])

      const block = simnet.mineBlock([
        { callPublicFn: { contract: 'quorum-market', method: 'mark-paid-out', args: [cv.ascii('market-004'), cv.principal(DEPLOYER)], sender: OTHER } }
      ])
      expect(block[0].result).toBeErr(cv.uint(109))
    })
  })

  // ── Read Helpers ───────────────────────────────────────────
  describe('read helpers', () => {
    it('get-market returns correct data', () => {
      const result = simnet.callReadOnlyFn('quorum-market', 'get-market', [cv.ascii(MARKET_ID)], DEPLOYER)
      expect(result.result).toBeSome(cv.tuple({
        status: cv.uint(1),
        'yes-pool': cv.uint(1500000),
        'no-pool': cv.uint(2000000),
        'winning-side': cv.some(cv.uint(1)),
        'resolution-price': cv.uint(6200000000),
      }))
    })

    it('get-market returns none for unknown market', () => {
      const result = simnet.callReadOnlyFn('quorum-market', 'get-market', [cv.ascii('unknown')], DEPLOYER)
      expect(result.result).toBeNone()
    })

    it('get-stake returns correct data', () => {
      const result = simnet.callReadOnlyFn('quorum-market', 'get-stake', [cv.ascii(MARKET_ID), cv.principal(DEPLOYER), cv.uint(1)], DEPLOYER)
      expect(result.result).toBeSome(cv.tuple({
        amount: cv.uint(1500000),
        'paid-out': cv.boolTrue(),
      }))
    })

    it('get-stake returns none for unknown stake', () => {
      const result = simnet.callReadOnlyFn('quorum-market', 'get-stake', [cv.ascii(MARKET_ID), cv.principal(OTHER), cv.uint(1)], DEPLOYER)
      expect(result.result).toBeNone()
    })
  })
})
