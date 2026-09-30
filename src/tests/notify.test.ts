import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentPlatform, notificationSupport } from '../lib/notify'

const setUA = (ua: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua)
const setStandalone = (v: boolean) => { window.matchMedia = ((q: string) => ({ matches: v && q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {} })) as any }

describe('avisos según la plataforma', () => {
    afterEach(() => { vi.restoreAllMocks(); delete (window as any).Notification; delete (window as any).vunlekDesktop })

    it('iPhone en Safari sin instalar: explica que hay que agregar VUNLEK a la pantalla de inicio', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1')
        setStandalone(false)
        ;(window as any).Notification = function () {}
        expect(currentPlatform()).toBe('ios-web')
        const s = notificationSupport()
        expect(s.supported).toBe(false)
        expect(s.hint).toMatch(/pantalla de inicio/)
    })
    it('iPhone con VUNLEK instalada sí permite avisos', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
        setStandalone(true)
        ;(window as any).Notification = function () {}
        expect(notificationSupport().supported).toBe(true)
    })
    it('Android y computadora con navegador moderno', () => {
        setStandalone(false)
        ;(window as any).Notification = function () {}
        setUA('Mozilla/5.0 (Linux; Android 14) Chrome/129 Mobile')
        expect(currentPlatform()).toBe('android-web')
        expect(notificationSupport().supported).toBe(true)
        setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129')
        expect(currentPlatform()).toBe('web')
        ;(window as any).vunlekDesktop = { isDesktop: true }
        expect(currentPlatform()).toBe('desktop-app')
    })
    it('navegador sin avisos', () => {
        setStandalone(false)
        setUA('Mozilla/5.0 (Windows NT 10.0) OldBrowser')
        expect(notificationSupport()).toMatchObject({ supported: false })
    })
})
