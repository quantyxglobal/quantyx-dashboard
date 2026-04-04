import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CaseIdGeneratorService } from '@/lib/case-id-generator'
import { EmailNotificationService } from '@/lib/email-notification-service'
import { requireAuth, handleAuthError } from '@/lib/auth-middleware'
import { z } from 'zod'
import { Timeline, CaseStatus } from '@prisma/client'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

// Validation schema for case creation
const createCaseSchema = z.object({
  case_title: z.string().min(1, 'Case title is required').max(200, 'Case title must be less than 200 characters'),
  description: z.string().optional(),
  specific_instructions: z.string().optional(),
  timeline: z.nativeEnum(Timeline).default(Timeline.NORMAL),
  estimate_required: z.boolean().default(false),
  services: z.array(z.string().uuid()).optional().default([])
})

/**
 * POST /api/cases
 * Creates a new case with timeline and estimate options
 * Uses enhanced authentication middleware for role-based access control
 */
export async function POST(request: NextRequest) {
  try {
    // Use enhanced authentication middleware
    const authContext = await requireAuth(['CLIENT'])()

    if (!authContext.user.organizationId) {
      return NextResponse.json(
        { error: 'User not associated with a firm' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createCaseSchema.parse(body)

    // Generate unique case ID using organization ID
    const caseIdGenerator = new CaseIdGeneratorService()
    const caseId = await caseIdGenerator.generateCaseId(authContext.user.organizationId)

    // Create case in transaction
    const newCase = await prisma.$transaction(async (tx) => {
      // Create the case
      const case_ = await tx.case.create({
        data: {
          case_id: caseId,
          organization_id: authContext.user.organizationId!,
          case_title: validatedData.case_title,
          description: validatedData.description,
          specific_instructions: validatedData.specific_instructions,
          timeline: validatedData.timeline,
          estimate_required: validatedData.estimate_required,
          status: CaseStatus.pending,
          owner_id: authContext.user.id
        },
        include: {
          organization: true,
          services: {
            include: {
              service: true
            }
          }
        }
      })

      // Add selected services
      if (validatedData.services.length > 0) {
        await tx.caseService.createMany({
          data: validatedData.services.map(serviceId => ({
            case_id: case_.id,
            service_id: serviceId
          }))
        })
      }

      return case_
    })

    // Send email notifications asynchronously
    try {
      const emailService = new EmailNotificationService({
        provider: 'console',
        fromEmail: process.env.EMAIL_FROM || 'noreply@quantyxglobal.com',
        fromName: 'Quantyx Global Case Management'
      })

      await emailService.sendCaseCreatedNotification(newCase.id)
    } catch (emailError) {
      // Log email error but don't fail the case creation
      console.error('Failed to send case creation notification:', emailError)
    }

    return NextResponse.json({
      success: true,
      case: {
        id: newCase.id,
        case_id: newCase.case_id,
        case_title: newCase.case_title,
        description: newCase.description,
        specific_instructions: newCase.specific_instructions,
        timeline: newCase.timeline,
        estimate_required: newCase.estimate_required,
        status: newCase.status,
        organization_name: newCase.organization.name,
        created_at: newCase.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Case creation error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: (error.errors || []).map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create case',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cases
 * Retrieves firm-specific case listing with enhanced access control
 * Uses RLS policies for automatic data filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Use enhanced authentication middleware - all roles can view cases
    const authContext = await requireAuth(['SUPER_ADMIN', 'ADMIN', 'CLIENT'])()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Max 50 per page
    const status = searchParams.get('status') as CaseStatus | null
    const timeline = searchParams.get('timeline') as Timeline | null
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // Build where clause - RLS policies will automatically filter based on user role
    const whereClause: any = {}

    // Add filters
    if (status) {
      whereClause.status = status
    }

    if (timeline) {
      whereClause.timeline = timeline
    }

    if (search) {
      whereClause.OR = [
        { case_id: { contains: search, mode: 'insensitive' } },
        { case_title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get cases with pagination - RLS policies handle access control automatically
    const [cases, totalCount] = await Promise.all([
      prisma.case.findMany({
        where: whereClause,
        select: {
          id: true,
          case_id: true,
          case_title: true,
          description: true,
          specific_instructions: true,
          timeline: true,
          estimate_required: true,
          status: true,
          created_at: true,
          updated_at: true,
          organization: {
            select: {
              id: true,
              name: true,
              display_name: true,
              firm_number: true
            }
          },
          services: {
            select: {
              service: {
                select: {
                  id: true,
                  name: true,
                  description: true
                }
              }
            }
          },
          _count: {
            select: {
              files: true,
              additional_requests: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.case.count({ where: whereClause })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      cases: cases.map(case_ => ({
        id: case_.id,
        case_id: case_.case_id,
        case_title: case_.case_title,
        description: case_.description,
        specific_instructions: case_.specific_instructions,
        timeline: case_.timeline,
        estimate_required: case_.estimate_required,
        status: case_.status,
        organization: {
          id: case_.organization.id,
          name: case_.organization.display_name || case_.organization.name,
          firm_number: case_.organization.firm_number
        },
        services: case_.services.map(cs => cs.service),
        file_count: case_._count.files,
        additional_request_count: case_._count.additional_requests,
        created_at: case_.created_at,
        updated_at: case_.updated_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      user_context: {
        role: authContext.user.role,
        organization_id: authContext.user.organizationId,
        firm_number: authContext.user.firmNumber
      }
    })

  } catch (error) {
    console.error('Case listing error:', error)

    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error) {
      return handleAuthError(error)
    }

    return NextResponse.json(
      { 
        error: 'Failed to retrieve cases',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}