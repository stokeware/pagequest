const authEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAuthEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() || null
}

export function isValidAuthEmail(email: string | null | undefined) {
    const normalizedEmail = normalizeAuthEmail(email)

    return normalizedEmail ? authEmailPattern.test(normalizedEmail) : false
}
