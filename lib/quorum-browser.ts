// Browser-side stake call for the Quorum market contract.
// Opens the Hiro wallet popup; user approves the USDCx transfer on-chain.

import {
  QUORUM_CONTRACT_ADDRESS,
  QUORUM_CONTRACT_NAME,
  USDCX_CONTRACT_ADDRESS,
  USDCX_CONTRACT_NAME,
  STACKS_NETWORK,
} from './quorum-config'

export interface StakeResult {
  txId: string
}

export async function stakeOnChain(params: {
  marketId: string
  side: 'yes' | 'no'
  amountUsdcx: number
  senderAddress: string
}): Promise<StakeResult> {
  const { openContractCall } = await import('@stacks/connect')
  const { StacksTestnet, StacksMainnet } = await import('@stacks/network')
  const {
    contractPrincipalCV,
    stringAsciiCV,
    uintCV,
    PostConditionMode,
  } = await import('@stacks/transactions')

  const network =
    STACKS_NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet()

  const microAmount = BigInt(Math.floor(params.amountUsdcx * 1_000_000))

  return new Promise((resolve, reject) => {
    openContractCall({
      contractAddress: QUORUM_CONTRACT_ADDRESS,
      contractName: QUORUM_CONTRACT_NAME,
      functionName: 'stake',
      functionArgs: [
        contractPrincipalCV(USDCX_CONTRACT_ADDRESS, USDCX_CONTRACT_NAME),
        stringAsciiCV(params.marketId),
        stringAsciiCV(params.side),
        uintCV(microAmount),
      ],
      network,
      // Allow mode lets the contract pull USDCx from the user
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data: any) => resolve({ txId: data.txId }),
      onCancel: () => reject(new Error('User cancelled')),
    } as any)
  })
}
