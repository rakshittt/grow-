import { LoginForm } from '@/components/features/auth/login-form'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  return <LoginForm error={params.error} next={params.next} />
}
