import { beforeAll } from 'vitest'

import '../node_modules/@hirosystems/clarinet-sdk/vitest-helpers/src/clarityValuesMatchers'

beforeAll(() => {
  ;(globalThis as any).options = {
    clarinet: {
      manifestPath: './Clarinet.toml',
      initBeforeEach: true,
      coverage: false,
      coverageFilename: 'lcov.info',
      costs: false,
      costsFilename: 'costs-reports.json',
      includeBootContracts: false,
      bootContractsPath: '',
    },
  }
})
