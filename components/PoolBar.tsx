'use client'

interface PoolBarProps {
  yesPool: number
  noPool: number
}

export default function PoolBar({ yesPool, noPool }: PoolBarProps) {
  const totalPool = yesPool + noPool
  const yesPercent = totalPool > 0 ? (yesPool / totalPool) * 100 : 50

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-green-400 font-medium">YES {yesPercent.toFixed(0)}%</span>
        <span className="text-red-400 font-medium">NO {(100 - yesPercent).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-[#1E1E2E] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
          style={{ width: `${yesPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#64748B] mt-1">
        <span>{yesPool} USDCx YES</span>
        <span>{noPool} USDCx NO</span>
      </div>
    </div>
  )
}
