import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BILLING_ENABLED } from '../lib/billing'
import { currentStore, onStorePurchase, syncStore, verifyPurchases } from '../lib/storeBilling'
import { SPACE_ACCESS_KEY, useSpaceAccess } from './useSpaceAccess'

/**
 * Mantiene al día la suscripción comprada en la tienda: al abrir la app envía al servidor
 * lo que App Store / Google Play tienen para la cuenta (renovaciones, reembolsos) y escucha
 * las compras que se confirman después (pagos pendientes, "Pedir permiso").
 * Solo corre en la app móvil, con los cobros activos y para quien administra el espacio.
 */
export function useStoreSync() {
    const { data: access } = useSpaceAccess()
    const qc = useQueryClient()
    const tenantId = access?.tenant_id
    const enabled = BILLING_ENABLED && !!currentStore() && !!tenantId && !!access?.can_manage && access?.tenant_type === 'INDEPENDENT'

    useEffect(() => {
        if (!enabled || !tenantId) return
        let off = () => { }
        let alive = true
        const refresh = () => qc.invalidateQueries({ queryKey: [SPACE_ACCESS_KEY] })

        syncStore(tenantId).then(r => { if (alive && r.found) refresh() }).catch(() => { /* sin señal: se reintenta al volver a abrir */ })
        onStorePurchase(purchases => {
            verifyPurchases(tenantId, purchases).then(refresh).catch(() => { })
        }).then(stop => { if (alive) off = stop; else stop() }).catch(() => { })

        return () => { alive = false; off() }
    }, [enabled, tenantId, qc])
}
