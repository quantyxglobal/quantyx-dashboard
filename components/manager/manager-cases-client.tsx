'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Briefcase, 
  Loader2, 
  Search, 
  Filter,
  ArrowUpDown,
  Eye
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Case {
  id: string
  case_number: string
  title: string
  status: string
  priority: string
  client_name: string
  created_at: string
  assigned_employees: Array<{
    id: string
    first_name: string
    last_name: string
  }>
}

export default function ManagerCasesClient() {
  const [cases, setCases] = useState<Case[]>([])
  const [filteredCases, setFilteredCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const { toast } = useToast()

  useEffect(() => {
    fetchCases()
  }, [])

  useEffect(() => {
    filterCases()
  }, [cases, searchQuery, statusFilter, priorityFilter])

  const fetchCases = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/manager/cases')

      if (!response.ok) {
        throw new Error('Failed to fetch cases')
      }

      const data = await response.json()
      setCases(data.cases || [])
    } catch (error) {
      console.error('Error fetching cases:', error)
      toast({
        title: 'Error',
        description: 'Failed to load cases',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const filterCases = () => {
    let filtered = [...cases]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.client_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status.toLowerCase() === statusFilter.toLowerCase())
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(c => c.priority.toLowerCase() === priorityFilter.toLowerCase())
    }

    setFilteredCases(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
      case 'assigned':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
      case 'pending_review':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
      case 'completed':
        return 'bg-green-500/10 text-green-700 dark:text-green-300'
      case 'delivered':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200'
      case 'high':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200'
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200'
      case 'low':
        return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-200'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {filteredCases.length} {filteredCases.length === 1 ? 'Case' : 'Cases'}
          </h2>
          {cases.length !== filteredCases.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setPriorityFilter('all')
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {filteredCases.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {cases.length === 0 
                  ? 'No cases assigned yet' 
                  : 'No cases match your filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCases.map(caseItem => (
              <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Link 
                          href={`/manager/cases/${caseItem.id}`}
                          className="font-semibold text-lg hover:text-primary transition-colors"
                        >
                          {caseItem.case_number}
                        </Link>
                        <Badge variant="outline" className={getPriorityColor(caseItem.priority)}>
                          {caseItem.priority}
                        </Badge>
                        <Badge className={getStatusColor(caseItem.status)}>
                          {caseItem.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                        {caseItem.title}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Client: <span className="font-medium text-foreground">{caseItem.client_name}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Created: <span className="font-medium text-foreground">{formatDate(caseItem.created_at)}</span>
                        </span>
                      </div>

                      {caseItem.assigned_employees.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Assigned to:</span>
                          <div className="flex flex-wrap gap-1">
                            {caseItem.assigned_employees.map(emp => (
                              <Badge key={emp.id} variant="secondary" className="text-xs">
                                {emp.first_name} {emp.last_name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Link href={`/manager/cases/${caseItem.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
