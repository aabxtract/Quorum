import {
  FLOWVAULT_NETWORK,
  FLOWVAULT_CONTRACT_ADDRESS,
  FLOWVAULT_CONTRACT_NAME,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
} from './flowvault-config'
import { FlowVault } from 'flowvault-sdk'

const AGENT_WALLET = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS || 'ST2K5BNBN6BSF3S4EQ0EFRMM4MD4JTGKF0PY90E70'

export function createBrowserVault(senderAddress: string) {
  return new FlowVault({
    network: FLOWVAULT_NETWORK as any,
    contractAddress: FLOWVAULT_CONTRACT_ADDRESS,
    contractName: FLOWVAULT_CONTRACT_NAME,
    tokenContractAddress: USDCX_CONTRACT_ADDRESS,
    tokenContractName: USDCX_CONTRACT_NAME,
    senderAddress,
    contractCallExecutor: async (call: any) => {
      const { openContractCall } = await import('@stacks/connect')
      const hiroProvider = (window as any).HiroWalletProvider
      if (!hiroProvider) {
        throw new Error('Hiro Wallet not detected. Please install the Hiro Wallet extension.')
      }
      // Xverse overwrites window.StacksProvider, so save/restore to force Hiro
      const prevProvider = (window as any).StacksProvider
      ;(window as any).StacksProvider = hiroProvider
      try {
        return await new Promise((resolve, reject) => {
          openContractCall({
            contractAddress: call.contractAddress,
            contractName: call.contractName,
            functionName: call.functionName,
            functionArgs: call.functionArgs,
            network: call.network,
            postConditionMode: 'allow' as any,
            postConditions: call.postConditions,
            onFinish: (data: any) => resolve({ txId: data.txId, status: 'success' } as any),
            onCancel: () => reject(new Error('User cancelled')),
          } as any)
        })
      } finally {
        ;(window as any).StacksProvider = prevProvider
      }
    },
  })
}

/**
 * Full stake flow executed from the user's browser wallet.
 *
 * 1. Set routing rule: split full stake amount to the agent wallet
 * 2. Deposit into user's vault — routing fires, stake lands in agent's wallet
 * 3. Clear routing rules (cleanup so next deposit isn't auto-routed)
 *
 * Returns the deposit txHash to submit to POST /api/markets/stake.
 */
export async function stakeOnMarket(
  userAddress: string,
  stakeMicro: string
): Promise<{ depositTxId: string }> {
  const vault = createBrowserVault(userAddress)

  // 1. Set routing rule — split to agent wallet
  const rulesResult = await vault.setRoutingRules({
    splitAddress: AGENT_WALLET,
    splitAmount: stakeMicro,
    lockAmount: '0',
    lockUntilBlock: 0,
  })
  if (rulesResult.status !== 'success') {
    throw new Error(`setRoutingRules failed: ${JSON.stringify(rulesResult)}`)
  }

  // 2. Deposit — routing fires, agent receives the stake
  const depositResult = await vault.deposit(stakeMicro)
  if (depositResult.status !== 'success') {
    throw new Error(`deposit failed: ${JSON.stringify(depositResult)}`)
  }

  // 3. Clear routing rules
  await vault.clearRoutingRules().catch(() => {})

  return { depositTxId: depositResult.txId }
}
