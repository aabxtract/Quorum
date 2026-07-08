import { FlowVault } from 'flowvault-sdk';

export function createBrowserVault(senderAddress: string) {
  const networkStr = process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK || 'testnet';
  
  return new FlowVault({
    network: networkStr as any,
    contractAddress: process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS || 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD',
    contractName: process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME || 'flowvault-v2',
    tokenContractAddress: process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    tokenContractName: process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME || 'usdcx',
    senderAddress,
    contractCallExecutor: async (call) => {
      const { request } = await import('@stacks/connect');
      return request('stx_callContract', {
        contract: call.contractAddress + '.' + call.contractName,
        functionName: call.functionName,
        functionArgs: call.functionArgs as any,
        network: call.network as any,
        postConditionMode: 'allow',
        postConditions: call.postConditions as any,
      });
    },
  });
}
