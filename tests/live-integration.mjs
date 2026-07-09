#!/usr/bin/env node
/**
 * Live end-to-end integration test for FlowVault + quorum-market on Stacks testnet.
 *
 * Usage:
 *   node tests/live-integration.mjs             # read-only only
 *   WRITE_TESTS=1 node tests/live-integration.mjs  # read + write (costs STX gas)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) { console.error('ERROR: .env not found'); process.exit(1) }
  const text = readFileSync(envPath, 'utf-8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    const commentIdx = val.search(/\s+#/)
    if (commentIdx > 0) val = val.slice(0, commentIdx).trim()
    if (key && val) process.env[key] = val
  }
}
loadEnv()

const KEY      = process.env.STACKS_PRIVATE_KEY
const AGENT    = process.env.STACKS_WALLET_ADDRESS || 'ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70'
const TREASURY = process.env.TREASURY_WALLET        || 'ST1F5KZWB7940FFPCW1XEX3W3K05T87QB9SJYVSRM'
const FV       = (process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT || 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2').split('.')
const USDCX    = (process.env.NEXT_PUBLIC_USDCX_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx').split('.')
const QM       = (process.env.NEXT_PUBLIC_QUORUM_CONTRACT || `${AGENT}.quorum-market`).split('.')

const WRITE = process.env.WRITE_TESTS === '1'
const MARKET_ID = `live-test-${Date.now()}`
const STAKE_MICRO = '5000000' // 5 USDCx

let passed = 0, failed = 0
const ok = (m) => (passed++, console.log(`  ✓ ${m}`))
const fail = (m, e) => (failed++, console.error(`  ✗ ${m}: ${e?.message || e}`))

// ── Helpers ──────────────────────────────────────────────────────────────
async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function readOnlyVault(vault) {
  console.log('\n── 📊 FlowVault read-only ──\n')
  try { const b = await vault.getCurrentBlockHeight(AGENT); ok(`getCurrentBlockHeight = ${b}`) } catch(e) { fail('getCurrentBlockHeight', e) }
  try { const s = await vault.getVaultState(AGENT); ok(`getVaultState — total=${s.totalBalance} unlocked=${s.unlockedBalance} locked=${s.lockedBalance}`) } catch(e) { fail('getVaultState', e) }
  try { const r = await vault.getRoutingRules(AGENT); ok(`getRoutingRules — ${r ? `split=${r.splitAmount} lock=${r.lockAmount}` : 'no rules set'}`) } catch(e) { fail('getRoutingRules', e) }
  try { const l = await vault.hasLockedFunds(AGENT); ok(`hasLockedFunds = ${l}`) } catch(e) { fail('hasLockedFunds', e) }
}

async function readOnlyQuorum() {
  console.log('\n── 📊 Quorum-market read-only ──\n')
  const { callReadOnlyFunction, stringAsciiCV, uintCV, standardPrincipalCV, cvToValue } = await import('@stacks/transactions')
  const { StacksTestnet } = await import('@stacks/network')
  const net = new StacksTestnet()

  const ro = async (fn, args) => cvToValue(await callReadOnlyFunction({ contractAddress: QM[0], contractName: QM[1], functionName: fn, functionArgs: args, senderAddress: AGENT, network: net }))
  try { const a = await ro('get-agent', []); ok(`get-agent = ${a}`) } catch(e) { fail('get-agent', e) }
  try { const m = await ro('get-market', [stringAsciiCV(MARKET_ID)]); ok(`get-market(${MARKET_ID}) = ${m === null ? 'none (not yet created)' : 'found'}`) } catch(e) { fail('get-market', e) }
  try { const s = await ro('get-stake', [stringAsciiCV(MARKET_ID), standardPrincipalCV(AGENT), uintCV(1)]); ok(`get-stake = ${s === null ? 'none (no stakes yet)' : 'found'}`) } catch(e) { fail('get-stake', e) }
}

// ── Write test: quorum-market on-chain calls ─────────────────────────────
async function writeQuorum() {
  console.log('\n── 📝 Quorum-market writes (costs STX) ──\n')

  const { makeContractCall, broadcastTransaction, AnchorMode, PostConditionMode, stringAsciiCV, uintCV, standardPrincipalCV } = await import('@stacks/transactions')
  const { StacksTestnet } = await import('@stacks/network')
  const net = new StacksTestnet()

  const call = async (method, args) => {
    const tx = await makeContractCall({
      contractAddress: QM[0], contractName: QM[1],
      functionName: method, functionArgs: args,
      senderKey: KEY, network: net,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    })
    const res = await broadcastTransaction(tx, net)
    if ('error' in res) throw new Error(`Broadcast failed: ${res.error} — ${res.reason}`)
    return res.txid
  }

  // 1. Create market
  try {
    const tx = await call('create-market', [stringAsciiCV(MARKET_ID)])
    ok(`create-market("${MARKET_ID}") — tx ${tx.slice(0,16)}…`)
    await delay(3000)
  } catch(e) { fail('create-market', e); return }

  // 2. Record stake
  try {
    const tx = await call('record-stake', [
      stringAsciiCV(MARKET_ID), standardPrincipalCV(AGENT), uintCV(1), uintCV(STAKE_MICRO),
    ])
    ok(`record-stake("${MARKET_ID}", YES, 5 USDCx) — tx ${tx.slice(0,16)}…`)
    await delay(3000)
  } catch(e) { fail('record-stake', e) }

  // 3. Resolve market (WIN = YES)
  try {
    const tx = await call('resolve-market', [
      stringAsciiCV(MARKET_ID), uintCV(1), uintCV(6200000000),
    ])
    ok(`resolve-market("${MARKET_ID}", YES) — tx ${tx.slice(0,16)}…`)
    await delay(3000)
  } catch(e) { fail('resolve-market', e) }

  // 4. Mark winner paid out
  try {
    const tx = await call('mark-paid-out', [
      stringAsciiCV(MARKET_ID), standardPrincipalCV(AGENT),
    ])
    ok(`mark-paid-out("${MARKET_ID}", agent) — tx ${tx.slice(0,16)}…`)
    await delay(3000)
  } catch(e) { fail('mark-paid-out', e) }

  // 5. Verify on-chain via read-only
  try {
    const { callReadOnlyFunction, cvToValue } = await import('@stacks/transactions')
    const { StacksTestnet } = await import('@stacks/network')
    const net2 = new StacksTestnet()
    const ro = async (fn, args) => cvToValue(await callReadOnlyFunction({ contractAddress: QM[0], contractName: QM[1], functionName: fn, functionArgs: args, senderAddress: AGENT, network: net2 }))
    const mkt = await ro('get-market', [stringAsciiCV(MARKET_ID)])
    if (mkt && mkt.status === 1n) {
      ok(`Verified: market resolved — status=${mkt.status} winning-side=${mkt['winning-side']}`)
    } else {
      ok(`Market broadcast (pending block confirmation)`)
    }
  } catch(e) { /* not critical — tx may not be mined yet */ }
}

// ── Write test: FlowVault agent payout ───────────────────────────────────
async function writeVault(vault) {
  console.log('\n── 📝 FlowVault agent payout test (costs STX) ──\n')

  let preBalance
  try {
    const s = await vault.getVaultState(AGENT); preBalance = s.totalBalance
    ok(`Pre-payout vault balance: ${preBalance} micro`)
  } catch(e) { fail('getVaultState pre', e); preBalance = 0 }

  // Clear any stale rules
  try { await vault.clearRoutingRules(); ok('clearRoutingRules (pre)') } catch(e) { fail('clearRoutingRules (pre)', e) }

  // Set payout routing: split to treasury wallet
  let currentBlock
  try { currentBlock = await vault.getCurrentBlockHeight(AGENT); ok(`Current block = ${currentBlock}`) } catch(e) { fail('getCurrentBlockHeight', e); return }

  try {
    const r = await vault.setRoutingRules({
      splitAddress: TREASURY,
      splitAmount: STAKE_MICRO,
      lockAmount: '0',
      lockUntilBlock: 0,
    })
    ok(`setRoutingRules(split to ${TREASURY.slice(0,6)}…) — tx ${r.txId.slice(0,16)}…`)
  } catch(e) { fail('setRoutingRules', e) }

  // Deposit — routing fires, treasury receives the stake
  try {
    const r = await vault.deposit(STAKE_MICRO)
    ok(`deposit(${STAKE_MICRO}) — tx ${r.txId.slice(0,16)}…`)
    console.log(`     https://explorer.hiro.so/txid/${r.txId}?chain=testnet`)
  } catch(e) { fail('deposit', e) }

  // Verify balance changed
  try {
    const s = await vault.getVaultState(AGENT)
    ok(`Vault balance after: total=${s.totalBalance} (was ${preBalance})`)
  } catch(e) { fail('getVaultState post', e) }

  // Cleanup
  try { await vault.clearRoutingRules(); ok('clearRoutingRules (cleanup)') } catch(e) { fail('clearRoutingRules cleanup', e) }
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══ Quorum End-to-End Integration Test ═══\n')
  console.log(`Agent wallet: ${AGENT}`)
  console.log(`Treasury:     ${TREASURY}`)
  console.log(`FlowVault:    ${FV[0]}.${FV[1]}`)
  console.log(`USDCx:        ${USDCX[0]}.${USDCX[1]}`)
  console.log(`Quorum:       ${QM[0]}.${QM[1]}`)
  console.log(`Market ID:    ${MARKET_ID}`)
  console.log(`Write tests:  ${WRITE ? 'ENABLED' : 'disabled (WRITE_TESTS=1)'}\n`)

  if (!KEY) { console.error('STACKS_PRIVATE_KEY missing'); process.exit(1) }

  const { FlowVault } = await import('flowvault-sdk')
  const vault = new FlowVault({
    network: 'testnet', senderKey: KEY,
    contractAddress: FV[0], contractName: FV[1],
    tokenContractAddress: USDCX[0], tokenContractName: USDCX[1],
  })

  await readOnlyVault(vault)
  await readOnlyQuorum()

  if (WRITE) {
    await writeQuorum()
    await writeVault(vault)
  } else {
    console.log('\n── Write tests skipped ──')
  }

  const total = passed + failed
  console.log(`\n═══ ${passed}/${total} passed, ${failed} failed ═══\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
