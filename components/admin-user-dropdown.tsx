'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Shield, Users, LogOut, ChevronDown, Building2, Crown, User } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'

interface FirmInfo {
  id: string
  name: string
  firmNumber?: string
  isFirm: boolean
}

interface AdminUserDropdownProps {
  userName: string
  userRole?: string
  firmInfo?: FirmInfo
  isEmployee?: boolean
  isSuperAdmin?: boolean
}

export function AdminUserDropdown({ userName, userRole = 'Administrator', firmInfo, isEmployee = false, isSuperAdmin = false }: AdminUserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg hover:bg-primary/5 transition-all duration-300 min-h-[44px] group"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Admin Badge */}
        <div className={`rounded-full px-3 py-1.5 shadow-glow ${
          userRole === 'Super Administrator' 
            ? 'bg-gradient-to-r from-accent to-accent/80' 
            : isEmployee
              ? 'bg-gradient-to-r from-blue-500 to-blue-600'
              : 'bg-gradient-to-r from-primary to-primary-glow'
        }`}>
          <div className="flex items-center gap-1">
            {userRole === 'Super Administrator' && <Crown className="h-3 w-3 text-accent-foreground" />}
            <span className="text-xs font-bold text-primary-foreground">
              {userRole === 'Super Administrator' ? 'SUPER ADMIN' : isEmployee ? 'EMPLOYEE' : 'ADMIN'}
            </span>
          </div>
        </div>
        
        {/* User Info - Hidden on mobile */}
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-sm font-medium text-foreground leading-tight">
            {userName}
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            {userRole}
          </span>
        </div>
        
        {/* Dropdown Arrow */}
        <ChevronDown 
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" />
          
          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-elegant z-50 overflow-hidden">
            {/* User Info Header - Always visible */}
            <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl shadow-glow ${
                  userRole === 'Super Administrator'
                    ? 'bg-gradient-to-br from-accent to-accent/80'
                    : 'bg-gradient-to-br from-primary to-primary-glow'
                }`}>
                  {userRole === 'Super Administrator' ? (
                    <Crown className="h-5 w-5 text-accent-foreground" />
                  ) : (
                    <Shield className="h-5 w-5 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {userRole}
                  </p>
                  {firmInfo && (
                    <div className="flex items-center gap-1 mt-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">
                        {firmInfo.firmNumber ? `Firm #${firmInfo.firmNumber}` : firmInfo.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <Link
                href="/admin/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-primary/5 transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                  <User className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <div>
                  <p className="font-medium">{isEmployee ? 'Employee Profile' : 'Profile'}</p>
                  <p className="text-xs text-muted-foreground">View and edit profile</p>
                </div>
              </Link>

              {isSuperAdmin && (
                <Link
                  href="/admin/users"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-primary/5 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">User Management</p>
                    <p className="text-xs text-muted-foreground">Manage client accounts</p>
                  </div>
                </Link>
              )}

              {/* Divider */}
              <div className="my-2 border-t border-border/50" />

              {/* Logout Button */}
              <div className="px-4 py-2">
                <LogoutButton 
                  variant="ghost" 
                  className="w-full justify-start gap-3 text-sm font-normal hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted group-hover:bg-destructive/10 transition-colors">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Sign Out</p>
                    <p className="text-xs text-muted-foreground">End {isEmployee ? 'employee' : 'admin'} session</p>
                  </div>
                </LogoutButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}