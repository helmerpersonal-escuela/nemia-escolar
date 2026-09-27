import type { CoopBundle } from '../lib/useCooperative'
import type { CoopContext } from '../lib/types'

export type CoopBundleCtx = Omit<CoopBundle, 'ctx'> & { ctx: CoopContext }
export { isThirdGrade, money, num, partnerName } from '../lib/types'
