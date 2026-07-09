# Quorum — FlowVault SDK Integration

How Quorum uses the FlowVault SDK: exactly which calls, in which order, for which part of the app.

---

## Contracts (Already Deployed — You Deploy Nothing)

```
FlowVault v2 (testnet): STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
USDCx token (testnet):  ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
```

Never mix testnet and mainnet principals. Both must come from the same network or all transfers fail.

---

## Installation

```bash
npm install flowvault-sdk@0.1.1
```

Pin the exact version. The contract interface is tightly coupled to it.

---

## Two SDK Instances in Quorum

Quorum uses FlowVault in two different contexts that require two different initialization modes.

### 1. Browser Wallet Mode — for followers depositing and withdrawing

Used in frontend components. Never touches a private key. Transaction signing happens in the user's Hiro/Leather wallet.

`lib/flowvault-browser.ts`
```typescript
import { request } from "@stacks/connect";
import { FlowVault } from "flowvault-sdk";

export function createBrowserVault(senderAddress: string) {
  return new FlowVault({
    network: "testnet",
    contractAddress: "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD",
    contractName: "flowvault-v2",
    tokenContractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    tokenContractName: "usdcx",
    senderAddress,
    contractCallExecutor: async (call) =>
      request("stx_callContract", {
        contract: call.contractAddress + "." + call.contractName,
        functionName: call.functionName,
        functionArgs: call.functionArgs,
        network: call.network,
        postConditionMode: "allow",
        postConditions: call.postConditions,
      }),
  });
}
```

### 2. Backend Signer Mode — for the AI agent executing settlements

Used only in Vercel serverless functions. The agent's private key signs transactions server-side. Never exposed to the browser.

`lib/flowvault-agent.ts`
```typescript
import { FlowVault } from "flowvault-sdk";

export const agentVault = new FlowVault({
  network: "testnet",
  contractAddress: "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD",
  contractName: "flowvault-v2",
  tokenContractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  tokenContractName: "usdcx",
  senderKey: process.env.STACKS_PRIVATE_KEY, // agent operator wallet only
});
```

---

## How the Contract Routes Money

Every deposit runs through this sequence — always in this exact order:

```
1. Split amount → sent to splitAddress immediately
2. Lock amount  → moved to locked balance until lockUntilBlock
3. Remainder    → stays unlocked, withdrawable immediately
```

If `split + lock` exceeds the deposit amount, the entire transaction aborts. Nothing partially applies. This is a safety invariant — validate amounts before calling deposit.

---

## The Three Vault Configurations Quorum Uses

### Configuration 1: Follower Deposit Vault (Hold)
Follower deposits USDCx into their personal vault. No split, no lock — just holds. The agent controls the routing rules on the agent's vault, not the follower's.

```typescript
// Called from follower's browser wallet (no routing rules needed for simple hold)
const vault = createBrowserVault(followerWalletAddress);

// Follower deposits 5000 USDCx (amounts always in microtokens as strings)
const result = await vault.deposit("5000000000"); // 5000 * 1_000_000
console.log("Deposit tx:", result.txId);
```

Store `result.txId` and the follower's wallet address in your `followers` table immediately.

---

### Configuration 2: Settlement Split (70/20/10)
Called by the **agent backend** after a trade closes. Routes proceeds across three destinations.

The contract only supports one `splitAddress` per routing rule call. To split across three wallets (followers, treasury, reserve), you execute two sequential `setRoutingRules` + `deposit` calls, or batch via a single rule targeting the treasury and handling the follower share separately.

**Practical approach for MVP:** use two calls.

**Call A — Treasury split (20%)**
```typescript
// Agent vault — backend signer mode
const totalProceeds = 1000000000; // 1000 USDCx in microtokens
const treasuryShare = Math.floor(totalProceeds * 0.20).toString();
const reserveShare = Math.floor(totalProceeds * 0.10).toString();
const followerShare = Math.floor(totalProceeds * 0.70).toString();

// Step 1: set routing to split treasury share + lock reserve
const currentBlock = await agentVault.getCurrentBlockHeight(
  process.env.STACKS_WALLET_ADDRESS!
);

await agentVault.setRoutingRules({
  lockAmount: reserveShare,           // 10% locked
  lockUntilBlock: currentBlock + 2000, // ~2 weeks in blocks
  splitAddress: process.env.TREASURY_WALLET!,
  splitAmount: treasuryShare,         // 20% to treasury
});

// Step 2: deposit total proceeds — routing fires automatically
const settleTx = await agentVault.deposit(totalProceeds.toString());
console.log("Settlement tx:", settleTx.txId);
```

After this call: treasury gets 20%, 10% is locked in the agent vault, 70% stays unlocked in agent vault for follower distribution.

**Call B — Distribute follower shares**
Query each follower's pro-rata share from your DB, then call `deposit` into each follower's vault address directly, or maintain a single pool and let followers withdraw their calculated share. For MVP simplicity, track shares in Postgres and let followers call `withdraw` for their calculated portion.

---

### Configuration 3: Loss Reserve Lock
When the agent takes a loss, the locked reserve absorbs it. The lock was already set in Configuration 2. Check it like this:

```typescript
const hasLock = await agentVault.hasLockedFunds(
  process.env.STACKS_WALLET_ADDRESS!
);

if (hasLock) {
  const state = await agentVault.getVaultState(
    process.env.STACKS_WALLET_ADDRESS!
  );
  console.log("Locked reserve:", state.locked);
  console.log("Unlocked (distributable):", state.unlocked);
}
```

The locked funds cannot be withdrawn until `lockUntilBlock` passes — enforced by the contract, not by your code. This is the mechanic that protects followers.

---

## Reading Vault State

Use these after every write to confirm the transition happened before updating your DB or UI.

```typescript
// Read agent vault state (backend)
const state = await agentVault.getVaultState(process.env.STACKS_WALLET_ADDRESS!);
// state.unlocked → immediately distributable
// state.locked   → in lock reserve

// Read follower vault state (frontend)
const vault = createBrowserVault(followerAddress);
const followerState = await vault.getVaultState(followerAddress);

// Read current routing rules
const rules = await agentVault.getRoutingRules(process.env.STACKS_WALLET_ADDRESS!);

// Read current block height (needed for lockUntilBlock calculation)
const block = await agentVault.getCurrentBlockHeight(process.env.STACKS_WALLET_ADDRESS!);
```

Poll after every write. Explorer latency means state won't update instantly — retry every 3 seconds until balance transitions appear.

---

## Follower Withdraw

Called from the frontend when a follower wants to exit. Only withdraws unlocked balance.

```typescript
const vault = createBrowserVault(followerWalletAddress);

// Check what's available first
const state = await vault.getVaultState(followerWalletAddress);

if (BigInt(state.unlocked) > 0n) {
  const result = await vault.withdraw(state.unlocked);
  console.log("Withdraw tx:", result.txId);
} else {
  // Funds still locked or nothing to withdraw
}
```

The contract enforces that locked funds cannot be withdrawn early — your UI just needs to show the right state.

---

## Clearing Routing Rules

After settlement is complete, clear routing rules so the agent vault returns to default hold behavior before the next trade cycle.

```typescript
await agentVault.clearRoutingRules();
```

Always call this after a settlement. If you forget, the next deposit will re-apply the old routing rules unexpectedly.

---

## Amount Handling — Critical

Always store and pass amounts as **strings or bigint**. Never floats.

```typescript
// USDCx uses 6 decimal places
// 1 USDCx = 1_000_000 microtokens

// CORRECT
const amount = "5000000"; // 5 USDCx as string

// WRONG — floating point will corrupt values
const amount = 5.0 * 1000000; // don't do this
```

Helper functions:
```typescript
export const toMicro = (amount: number): string =>
  (BigInt(Math.floor(amount)) * 1_000_000n).toString();

export const fromMicro = (micro: string): number =>
  Number(BigInt(micro)) / 1_000_000;
```

---

## Lock Block Validation

Always compute `lockUntilBlock` dynamically from the current block height. Never hardcode a block number.

```typescript
const current = await agentVault.getCurrentBlockHeight(
  process.env.STACKS_WALLET_ADDRESS!
);
const lockUntilBlock = current + 2000; // ~2000 blocks ≈ 2 weeks on Stacks
```

If `lockUntilBlock` is in the past when you call `setRoutingRules`, the transaction will fail.

---

## Error Handling

```typescript
import {
  InvalidAmountError,
  InvalidAddressError,
  InvalidRoutingRuleError,
} from "flowvault-sdk";

try {
  await agentVault.deposit(amount);
} catch (error) {
  if (error?.name === "InvalidAddressError") {
    // Agent wallet not properly initialized — check STACKS_PRIVATE_KEY
  }
  if (error?.name === "InvalidAmountError") {
    // Amount is zero, negative, or not a valid string
  }
  if (error?.name === "InvalidRoutingRuleError") {
    // split + lock exceeds deposit amount, or lockUntilBlock is in the past
  }
  // Always log txId if available for explorer debugging
  throw error;
}
```

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Deposit tx fails immediately | `split + lock` exceeds deposit amount | Validate `splitAmount + lockAmount < depositAmount` before calling |
| Withdraw fails despite deposits | Funds still locked | Poll `getCurrentBlockHeight` and wait until past `lockUntilBlock` |
| `InvalidAddressError` with `tb1...` | App read a Bitcoin address instead of STX address | Always extract `wallet.accounts[0].stxAddress` not `address` |
| Read call returns parsing error | Wrong contract principal in env vars | Verify both `contractAddress` and `tokenContractAddress` are testnet values |
| Routing rules applying to wrong cycle | Forgot to call `clearRoutingRules` after settlement | Always call `clearRoutingRules()` at the end of every settlement flow |

---

## Env Vars Checklist

```bash
# Required for both frontend + backend
NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS=STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD
NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME=flowvault-v2
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME=usdcx
NEXT_PUBLIC_FLOWVAULT_NETWORK=testnet

# Required for agent serverless functions only (never expose to browser)
STACKS_PRIVATE_KEY=           # Agent operator wallet private key
STACKS_WALLET_ADDRESS=        # Agent operator STX address (ST...)
TREASURY_WALLET=              # Treasury STX address (ST...)
```

---

## Smoke Test — Run Before Writing Any UI

Before building anything else, verify the SDK works end-to-end with two wallets on testnet:

```
1. Init agentVault with STACKS_PRIVATE_KEY
2. Call getCurrentBlockHeight — confirm you get a number back
3. Call setRoutingRules with lockAmount=1000000, lockUntilBlock=current+100, no split
4. Call deposit("5000000") — copy the txId
5. Check txId on https://explorer.hiro.so/txid/{txId}?chain=testnet
6. Call getVaultState — confirm locked balance updated
7. Call clearRoutingRules
8. Call getVaultState again — confirm rules cleared
```

All 8 steps must pass before Day 2 agent work starts. If step 4 fails, your private key or principal is wrong — fix it before writing any agent logic on top.

---

*Full FlowVault docs: https://docs.flow-vault.dev*
