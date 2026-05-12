import { describe, expect, it } from 'vitest'

import { getAuthUiConfig } from '@/lib/auth/config'
import {
    getDefaultProtectedPath,
    getSignedInLandingPath,
} from '@/lib/auth/access'

describe('auth config', () => {
    it('returns the app-owned credentials label and seeded local emails', () => {
        expect(getAuthUiConfig()).toEqual({
            localDemoEmails: [
                'admin@pagequest.local',
                'alice@pagequest.local',
                'ben@pagequest.local',
                'clara@pagequest.local',
                'future-reader@pagequest.local',
            ],
            providerLabel: 'Page Quest account',
        })
    })
})

describe('auth landing paths', () => {
    it('returns the default protected path for each role set', () => {
        expect(getDefaultProtectedPath(['ADMIN'])).toBe('/admin')
        expect(getDefaultProtectedPath(['COMPETITOR'])).toBe('/dashboard')
        expect(getDefaultProtectedPath([])).toBe('/')
    })

    it('prefers an explicit protected callback URL for signed-in users', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/admin/reports?view=weekly',
                grantedRoles: ['ADMIN'],
            })
        ).toBe('/admin/reports?view=weekly')
    })

    it('falls back to the role landing page when callback URL is public', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/',
                grantedRoles: ['COMPETITOR'],
                isAuthenticated: true,
            })
        ).toBe('/dashboard')

        expect(
            getSignedInLandingPath({
                callbackUrl: '/sign-in?callbackUrl=%2Fdashboard',
                grantedRoles: ['ADMIN'],
                isAuthenticated: true,
            })
        ).toBe('/admin')
    })

    it('routes signed-in users without admin access to the dashboard', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/',
                grantedRoles: [],
                isAuthenticated: true,
            })
        ).toBe('/dashboard')
    })
})
