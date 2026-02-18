import { useEffect, useState } from 'react'

export const useAppMode = () => {
    const [isAppMode, setIsAppMode] = useState(false)

    useEffect(() => {
        const checkAppMode = () => {
            // Check for standalone mode (PWA)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true

            // Check for specific User Agent
            const isCustomApp = navigator.userAgent.includes('VunlekApp')

            // Check for query param override (e.g. ?mode=app)
            const params = new URLSearchParams(window.location.search)
            const isAppParam = params.get('mode') === 'app'

            // Persist the mode if detected via params
            if (isAppParam) {
                sessionStorage.setItem('vunlek_app_mode', 'true')
            }

            const isSessionApp = sessionStorage.getItem('vunlek_app_mode') === 'true'

            setIsAppMode(isStandalone || isCustomApp || isAppParam || isSessionApp)
        }

        checkAppMode()
    }, [])

    return { isAppMode }
}
