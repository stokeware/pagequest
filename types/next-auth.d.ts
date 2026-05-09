import type { AppRole } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
    interface Session {
        user: DefaultSession['user'] & {
            id: string
            roles: AppRole[]
        }
    }

    interface User {
        id: string
        roles: AppRole[]
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        roles?: AppRole[]
        userId?: string
    }
}
