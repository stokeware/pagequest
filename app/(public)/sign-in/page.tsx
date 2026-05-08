import {
    Button,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import { PublicShell } from '@/components/public/public-shell'

export default function SignInPage() {
    return (
        <PublicShell
            eyebrow='Authentication'
            title='Sign in before the next chapter begins.'
            description='This route is the public auth landing page for local development now and Auth.js integration in Phase 3.'
        >
            <FormCard
                title='Sign in'
                description='Use the local-first entry point now. Auth.js providers and real session handling will attach here next.'
            >
                <FormField label='Email address' htmlFor='email'>
                    <Input
                        id='email'
                        type='email'
                        inputMode='email'
                        placeholder='reader@example.com'
                        autoComplete='email'
                    />
                </FormField>

                <FormField label='Password' htmlFor='password'>
                    <Input
                        id='password'
                        type='password'
                        placeholder='Enter your password'
                        autoComplete='current-password'
                    />
                </FormField>

                <FormActions note='The shell is ready for local sign-in, sign-out, and role-aware routing.'>
                    <Button disabled>Auth wiring arrives in Phase 3</Button>
                </FormActions>
            </FormCard>
        </PublicShell>
    )
}
