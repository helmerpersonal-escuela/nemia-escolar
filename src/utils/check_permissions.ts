
import { supabase } from '../lib/supabase'

export const checkAdminPermissions = async () => {
    console.log("Checking Admin Permissions...")
    const { data: { user } } = await supabase.auth.getUser()
    console.log("Current User:", user?.id)

    // Try to fetch ALL profiles (not just mine)
    const { data, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })

    if (error) {
        console.error("Error fetching profiles:", error)
        return { success: false, error }
    }

    console.log(`Found ${count} profiles.`)
    console.log("First 3:", data?.slice(0, 3))

    return { success: true, count, data }
}
