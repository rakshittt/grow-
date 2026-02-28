import { SignupForm } from '@/components/features/auth/signup-form'

interface SignupPageProps {
  searchParams: Promise<{ error?: string; message?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  return <SignupForm error={params.error} message={params.message} />
}
