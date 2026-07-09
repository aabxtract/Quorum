import { FlowVault } from 'flowvault-sdk'
import {
  FLOWVAULT_CONTRACT_ADDRESS,
  FLOWVAULT_CONTRACT_NAME,
  FLOWVAULT_NETWORK,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
} from './flowvault-config'

// @stacks/connect v7 uses callback-based openContractCall; FlowVault expects a
// Promise-returning executor, so we wrap it.

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
      return new Promise((resolve, reject) => {
        openContractCall({
          contractAddress: call.contractAddress,
          contractName: call.contractName,
          functionName: call.functionName,
          functionArgs: call.functionArgs,
          network: call.network,
          postConditionMode: 'allow' as any,
          postConditions: call.postConditions,
          onFinish: (data: any) => {
            resolve({ txId: data.txId, status: 'success' } as any)
          },
          onCancel: () => reject(new Error('User cancelled')),
        } as any)
      })
    },
  })
}
