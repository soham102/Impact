import { useNavigate } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <EmptyState
      title="Page not found"
      body="The page you're looking for doesn't exist or has moved."
      action={<Button onClick={() => navigate('/')}>Go to For You</Button>}
    />
  )
}
