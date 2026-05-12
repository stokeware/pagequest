import { describe, expect, it } from 'vitest'

import {
    getCreateAdminPasswordNotice,
    getCreateAdminSecurityNotice,
    isHostedDatabaseTarget,
    parseCreateAdminArgs,
    resolveCreateAdminBootstrapSecret,
    resolveCreateAdminDatabaseUrl,
    validateCreateAdminInput,
    verifyCreateAdminBootstrapSecret,
} from '@/lib/admin-account-cli'

describe('admin account CLI helpers', () => {
    it('parses supported command-line arguments', () => {
        expect(
            parseCreateAdminArgs([
                '--name',
                'Morgan Questmaster',
                '--email',
                'ADMIN@PAGEQUEST.ING',
                '--password',
                'correct horse battery staple',
                '--repeat-password',
                'correct horse battery staple',
            ])
        ).toEqual({
            email: 'ADMIN@PAGEQUEST.ING',
            help: false,
            name: 'Morgan Questmaster',
            password: 'correct horse battery staple',
            passwordRepeat: 'correct horse battery staple',
        })
    })

    it('normalizes and validates prompted input', () => {
        expect(
            validateCreateAdminInput({
                email: ' Admin@PageQuest.ing ',
                name: ' Morgan Questmaster ',
                password: 'secret-value',
                passwordRepeat: 'secret-value',
            })
        ).toEqual({
            email: 'admin@pagequest.ing',
            name: 'Morgan Questmaster',
            password: 'secret-value',
        })
    })

    it('rejects mismatched passwords', () => {
        expect(() =>
            validateCreateAdminInput({
                email: 'admin@pagequest.ing',
                name: 'Morgan Questmaster',
                password: 'secret-value',
                passwordRepeat: 'different-value',
            })
        ).toThrow(/Passwords do not match/)
    })

    it('requires DIRECT_URL for privileged database operations', () => {
        expect(
            resolveCreateAdminDatabaseUrl({
                DIRECT_URL: 'postgresql://direct.example/pagequest',
            })
        ).toBe('postgresql://direct.example/pagequest')
    })

    it('classifies non-loopback targets as hosted databases', () => {
        expect(
            isHostedDatabaseTarget(
                'postgresql://pagequest:secret@ep-prod.neon.tech/pagequest'
            )
        ).toBe(true)

        expect(
            isHostedDatabaseTarget(
                'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest'
            )
        ).toBe(false)
    })

    it('requires a second bootstrap secret for hosted targets', () => {
        expect(() =>
            resolveCreateAdminBootstrapSecret(
                {},
                'postgresql://pagequest:secret@ep-prod.neon.tech/pagequest'
            )
        ).toThrow(/PAGEQUEST_ADMIN_BOOTSTRAP_SECRET/)

        expect(
            resolveCreateAdminBootstrapSecret(
                {
                    PAGEQUEST_ADMIN_BOOTSTRAP_SECRET: 'admin-bootstrap-secret',
                },
                'postgresql://pagequest:secret@ep-prod.neon.tech/pagequest'
            )
        ).toBe('admin-bootstrap-secret')
    })

    it('does not require the bootstrap secret for local targets', () => {
        expect(
            resolveCreateAdminBootstrapSecret(
                {},
                'postgresql://pagequest:pagequest@localhost:5433/pagequest'
            )
        ).toBeNull()
    })

    it('verifies the bootstrap secret with a constant-time comparison', () => {
        expect(() =>
            verifyCreateAdminBootstrapSecret({
                expectedSecret: 'admin-bootstrap-secret',
                providedSecret: 'admin-bootstrap-secret',
            })
        ).not.toThrow()

        expect(() =>
            verifyCreateAdminBootstrapSecret({
                expectedSecret: 'admin-bootstrap-secret',
                providedSecret: 'wrong-bootstrap-secret',
            })
        ).toThrow(/Bootstrap secret is not valid/)
    })

    it('documents that the password is stored as a Page Quest hash', () => {
        expect(getCreateAdminPasswordNotice()).toMatch(/password hash/)
    })

    it('documents the hosted provisioning secret requirement', () => {
        expect(getCreateAdminSecurityNotice()).toMatch(
            /PAGEQUEST_ADMIN_BOOTSTRAP_SECRET/
        )
    })
})
