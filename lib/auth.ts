import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, usersTable, agenciesTable } from '@/lib/db'

// ----------------------------------------------------------------
// TypeScript augmentation — add agencyId to the Session type
// ----------------------------------------------------------------
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      agencyId: string
      role: string
    }
  }
  interface User {
    agencyId?: string
    role?: string
  }
}

// ----------------------------------------------------------------
// Auth.js configuration
// ----------------------------------------------------------------
export const authConfig: NextAuthConfig = {
  providers: [
    // ── Email / Password ──────────────────────────────────────
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.query.usersTable.findFirst({
          where: eq(usersTable.email, credentials.email as string),
        })

        if (!user || !user.password_hash) return null

        const valid = await compare(credentials.password as string, user.password_hash)
        if (!valid) return null

        return {
          id:       user.id,
          email:    user.email,
          name:     user.full_name,
          image:    user.avatar_url,
          agencyId: user.agency_id,
          role:     user.role,
        }
      },
    }),

    // ── Google OAuth ─────────────────────────────────────────
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn:  '/login',
    signOut: '/login',
    error:   '/login',
  },

  callbacks: {
    // ── After sign-in: provision agency + user row for OAuth users
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const existing = await db.query.usersTable.findFirst({
          where: eq(usersTable.email, user.email),
        })

        if (!existing) {
          // Create agency then user
          const domain = user.email.split('@')[1] ?? 'agency'
          const slug   = domain.replace(/\./g, '-') + '-' + Math.random().toString(36).slice(2, 8)

          const [newAgency] = await db
            .insert(agenciesTable)
            .values({
              name:          domain,
              slug,
              plan:          'trial',
              trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            })
            .returning()

          const [newUser] = await db
            .insert(usersTable)
            .values({
              agency_id:  newAgency.id,
              email:      user.email,
              full_name:  user.name ?? null,
              avatar_url: user.image ?? null,
              role:       'owner',
            })
            .returning()

          // Attach for JWT
          user.id       = newUser.id
          user.agencyId = newAgency.id
          user.role     = 'owner'
        } else {
          user.id       = existing.id
          user.agencyId = existing.agency_id
          user.role     = existing.role
        }
      }
      return true
    },

    // ── Embed agencyId + role into the JWT on sign-in
    async jwt({ token, user }) {
      if (user) {
        token.userId   = user.id!
        token.agencyId = user.agencyId ?? ''
        token.role     = user.role ?? 'member'
      }
      return token
    },

    // ── Expose userId + agencyId on the session object
    async session({ session, token }) {
      session.user.id       = (token.userId as string) ?? ''
      session.user.agencyId = (token.agencyId as string) ?? ''
      session.user.role     = (token.role as string) ?? 'member'
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
