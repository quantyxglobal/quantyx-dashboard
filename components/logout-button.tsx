'use client'

import { logout } from '@/app/actions/logout'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  onClick?: () => void
  children?: React.ReactNode
}

export function LogoutButton({ 
  variant = 'outline', 
  size = 'sm', 
  className, 
  onClick,
  children 
}: LogoutButtonProps) {
  const handleLogout = async () => {
    if (onClick) onClick()
    await logout()
  }

  return (
    <Button
      onClick={handleLogout}
      variant={variant}
      size={size}
      className={cn(
        variant === 'outline' && "gap-2 bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:bg-destructive/5 hover:border-destructive/50 hover:text-destructive transition-all duration-300",
        className
      )}
    >
      {children || (
        <>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </>
      )}
    </Button>
  )
}
