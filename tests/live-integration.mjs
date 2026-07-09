#!/usr/bin/env node
/**
 * Live integration test for FlowVault + quorum-market on Stacks testnet.
 *
 * Usage:
 *   node tests/live-integration.mjs
 *
 * Safe by default — only runs read-only queries.
 * To test write operations (costs testnet STX gas):
 *   WRITE_TESTS=1 node tests/live-integration.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── Load .env ──────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) {
    console.error('ERROR: .env file not found at', envPath)
    process.exit(1)
  }
  const text = readFileSync(envPath, 'utf-8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    const commentIdx = val.search(/\s+#/)
    if (commentIdx > 0) val = val.slice(0, commentIdx).trim()
    if (key && val) process.env[key] = val
  }
}

loadEnv()

const STACKS_PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY
const STACKS_WALLET_ADDRESS = process.env.STACKS_WALLET_ADDRESS || 'ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70'
const TREASURY_WALLET = process.env.TREASURY_WALLET || 'ST1F5KZWB7940FFPCW1XEX3W3K05T87QB9SJYVSRM'
const FLOWVAULT_CONTRACT = (process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT || 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2').split('.')
const USDCX_CONTRACT = (process.env.NEXT_PUBLIC_USDCX_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx').split('.')
const QUORUM_CONTRACT = (process.env.NEXT_PUBLIC_QUORUM_CONTRACT || `${STACKS_WALLET_ADDRESS}.quorum-market`).split('.')

const WRITE_TESTS = process.env.WRITE_TESTS === '1'
const AMOUNT_MICRO = '5000000' // 5 USDCx in micro-units

let passed = 0
let failed = 0

function ok(msg) { passed++; console.log(`  ✓ ${msg}`) }
function fail(msg, err) { failed++; console.error(`  ✗ ${msg}: ${err?.message || err}`) }

async function readOnlyVaultTests(vault) {
  console.log('\n── FlowVault read-only ──\n')

  let block
  try {
    block = await vault.getCurrentBlockHeight(STACKS_WALLET_ADDRESS)
    if (typeof block === 'number' && block > 0) ok(`getCurrentBlockHeight = ${block}`)
    else fail('getCurrentBlockHeight', block)
  } catch (e) { fail('getCurrentBlockHeight', e) }

  try {
    const state = await vault.getVaultState(STACKS_WALLET_ADDRESS)
    if (typeof state.totalBalance === 'number') ok(`getVaultState — total=${state.totalBalance} unlocked=${state.unlockedBalance} locked=${state.lockedBalance}`)
    else fail('getVaultState', JSON.stringify(state))
  } catch (e) { fail('getVaultState', e) }

  try {
    const rules = await vault.getRoutingRules(STACKS_WALLET_ADDRESS)
    if (rules === null || typeof rules.splitAmount !== 'undefined') ok(`getRoutingRules — ${rules ? `split=${rules.splitAmount} lock=${rules.lockAmount}` : 'no rules set'}`)
    else fail('getRoutingRules', JSON.stringify(rules))
  } catch (e) { fail('getRoutingRules', e) }

  try {
    const locked = await vault.hasLockedFunds(STACKS_WALLET_ADDRESS)
    ok(`hasLockedFunds = ${locked}`)
  } catch (e) { fail('hasLockedFunds', e) }

  return block
}

async function readOnlyQuorumTests() {
  console.log('\n── Quorum-market read-only ──\n')

  const { callReadOnlyFunction, stringAsciiCV, uintCV, standardPrincipalCV } = await import('@stacks/transactions')
  const { StacksTestnet } = await import('@stacks/network')
  const network = new StacksTestnet()
  const addr = STACKS_WALLET_ADDRESS

  const readOnly = async (fn, args) => {
    const { cvToValue, callReadOnlyFunction } = await import('@stacks/transactions')
    const result = await callReadOnlyFunction({
      contractAddress: QUORUM_CONTRACT[0],
      contractName: QUORUM_CONTRACT[1],
      functionName: fn,
      functionArgs: args,
      senderAddress: addr,
      network,
    })
    return cvToValue(result)
  }

  // get-agent
  try {
    const agent = await readOnly('get-agent', [])
    if (typeof agent === 'string' && agent.startsWith('ST')) ok(`get-agent = ${agent}`)
    else fail('get-agent', JSON.stringify(agent))
  } catch (e) { fail('get-agent', e) }

  // get-market for a known test market
  try {
    const result = await readOnly('get-market', [stringAsciiCV('test-market-001')])
    // If market exists, result is an object. If not, it's null.
    // Simnet would return Clarity optional; testnet returns JS value.
    if (result === null || result === undefined) {
      ok('get-market(test-market-001) = none (no such market created on live yet)')
    } else {
      ok(`get-market found: status=${result.status} yes-pool=${result['yes-pool']} no-pool=${result['no-pool']}`)
    }
  } catch (e) { fail('get-market', e) }

  // get-stake for a known stake
  try {
    const result = await readOnly('get-stake', [
      stringAsciiCV('test-market-001'),
      standardPrincipalCV(addr),
      uintCV(1),
    ])
    if (result === null || result === undefined) {
      ok('get-stake(test-market-001) = none (no live stakes yet)')
    } else {
      ok(`get-stake found: amount=${result.amount} paid-out=${result['paid-out']}`)
    }
  } catch (e) { fail('get-stake', e) }
}

async function writeTests(vault) {
  console.log('\n── Write tests (costs STX gas) ──\n')

  try {
    const result = await vault.clearRoutingRules()
    if (result.txId && result.status === 'success') ok(`clearRoutingRules — tx ${result.txId}`)
    else fail('clearRoutingRules', JSON.stringify(result))
  } catch (e) { fail('clearRoutingRules', e) }

  let currentBlock
  try {
    currentBlock = await vault.getCurrentBlockHeight(STACKS_WALLET_ADDRESS)
    ok(`Current block = ${currentBlock}`)
  } catch (e) { fail('getCurrentBlockHeight', e); return }

  try {
    const result = await vault.setRoutingRules({
      lockAmount: AMOUNT_MICRO,
      lockUntilBlock: currentBlock + 100,
      splitAddress: null,
      splitAmount: '0',
    })
    if (result.txId && result.status === 'success') {
      ok(`setRoutingRules — tx ${result.txId} (lock ${AMOUNT_MICRO})`)
      try {
        const rules = await vault.getRoutingRules(STACKS_WALLET_ADDRESS)
        if (rules && BigInt(rules.lockAmount) > 0n) ok(`Verified lockAmount = ${rules.lockAmount} on-chain`)
      } catch (e2) { /* skip */ }
    } else fail('setRoutingRules', JSON.stringify(result))
  } catch (e) { fail('setRoutingRules', e) }

  try {
    const result = await vault.deposit(AMOUNT_MICRO)
    if (result.txId && result.status === 'success') {
      ok(`deposit(${AMOUNT_MICRO}) — tx ${result.txId}`)
      console.log(`     https://explorer.hiro.so/txid/${result.txId}?chain=testnet`)
    } else fail('deposit', JSON.stringify(result))
  } catch (e) { fail('deposit', e) }

  try {
    const state = await vault.getVaultState(STACKS_WALLET_ADDRESS)
    ok(`Vault after deposit — total=${state.totalBalance} unlocked=${state.unlockedBalance} locked=${state.lockedBalance}`)
  } catch (e) { fail('getVaultState after deposit', e) }

  try {
    const result = await vault.clearRoutingRules()
    if (result.txId && result.status === 'success') ok(`clearRoutingRules (cleanup) — tx ${result.txId}`)
  } catch (e) { fail('clearRoutingRules cleanup', e) }
}

async function main() {
  console.log('═══ Quorum Live Integration Test ═══\n')
  console.log(`Network: testnet`)
  console.log(`Agent wallet: ${STACKS_WALLET_ADDRESS}`)
  console.log(`Treasury: ${TREASURY_WALLET}`)
  console.log(`FlowVault: ${FLOWVAULT_CONTRACT[0]}.${FLOWVAULT_CONTRACT[1]}`)
  console.log(`USDCx: ${USDCX_CONTRACT[0]}.${USDCX_CONTRACT[1]}`)
  console.log(`Quorum market: ${QUORUM_CONTRACT[0]}.${QUORUM_CONTRACT[1]}`)
  console.log(`Write tests: ${WRITE_TESTS ? 'ENABLED (costs gas)' : 'disabled (use WRITE_TESTS=1 to enable)'}`)

  if (!STACKS_PRIVATE_KEY) {
    console.error('\nERROR: STACKS_PRIVATE_KEY not found.')
    process.exit(1)
  }

  const { FlowVault } = await import('flowvault-sdk')

  const vault = new FlowVault({
    network: 'testnet',
    contractAddress: FLOWVAULT_CONTRACT[0],
    contractName: FLOWVAULT_CONTRACT[1],
    tokenContractAddress: USDCX_CONTRACT[0],
    tokenContractName: USDCX_CONTRACT[1],
    senderKey: STACKS_PRIVATE_KEY,
  })

  await readOnlyVaultTests(vault)

  await readOnlyQuorumTests()

  if (WRITE_TESTS) {
    try { await writeTests(vault) } catch (e) { console.error('Fatal in write tests:', e) }
  } else {
    console.log('\n── Write tests skipped (pass WRITE_TESTS=1 to run) ──')
  }

  const total = passed + failed
  console.log(`\n═══ Results: ${passed}/${total} passed, ${failed} failed ═══\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('Unhandled error:', e); process.exit(1) })
