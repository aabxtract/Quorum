import { FlowVault } from 'flowvault-sdk';

const networkStr = process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK || 'testnet';

export const agentVault = new FlowVault({
  network: networkStr as any,
  contractAddress: process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS || 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD',
  contractName: process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME || 'flowvault-v2',
  tokenContractAddress: process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  tokenContractName: process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME || 'usdcx',
  senderKey: process.env.STACKS_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
});

// Micro token conversion (USDCx = 6 decimals)
export const toMicro = (amount: number): string =>
  (BigInt(Math.floor(amount * 1_000_000))).toString();

export const fromMicro = (micro: string): number =>
  Number(BigInt(micro)) / 1_000_000;

export async function executeAtomicSettlement(params: {
  totalPool: number        // total USDCx in market
  winnerPool: number       // total staked on winning side
  loserPool: number        // total staked on losing side
  winnerAddress: string    // aggregated winner wallet (use treasury as router)
}): Promise<string> {
  const { totalPool, loserPool } = params

  // Protocol takes 5% of loser pool
  const protocolFee = loserPool * 0.05
  const winnerPayout = loserPool * 0.95

  // Get current block height for lock
  const currentBlock = await agentVault.getCurrentBlockHeight(
    process.env.STACKS_WALLET_ADDRESS || ''
  )

  // ATOMIC CYCLE — 4 steps, no deviation
  // Step 1: Clear any stale routing rules
  await agentVault.clearRoutingRules()
  console.log('Step 1: Rules cleared')

  // Step 2: Set routing — split winner payout + lock protocol fee
  await agentVault.setRoutingRules({
    splitAddress: process.env.TREASURY_WALLET || '',
    splitAmount: toMicro(winnerPayout),
    lockAmount: toMicro(protocolFee),
    lockUntilBlock: currentBlock + 1000
  })
  console.log('Step 2: Routing rules set')

  // Step 3: Deposit total pool — routing fires automatically
  const settleTx = await agentVault.deposit(toMicro(totalPool))
  console.log('Step 3: Settlement tx:', settleTx.txId)

  // Step 4: Clear rules — reset for next market
  await agentVault.clearRoutingRules()
  console.log('Step 4: Rules cleared — cycle complete')

  return settleTx.txId
}
