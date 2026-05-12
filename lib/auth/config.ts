export const localDemoEmails = [
    'admin@pagequest.local',
    'alice@pagequest.local',
    'ben@pagequest.local',
    'clara@pagequest.local',
    'future-reader@pagequest.local',
] as const

export function getAuthUiConfig() {
    return {
        localDemoEmails,
        providerLabel: 'Page Quest account',
    }
}
