import { Suspense } from 'react'
import LoginForm from '@/components/LoginForm'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-indigo-400">IcognitoChat</h1>
        <p className="mt-2 text-slate-400">Chat anônimo e privado</p>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
